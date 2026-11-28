#!/usr/bin/env python3
"""
Vision Chat cloud server: one OpenAI-compatible endpoint for a vision-language
chat model plus an image generator, on a single 16 GB GPU box (Kaggle / Colab / rented).

Endpoints (all but /health need  "Authorization: Bearer $API_KEY"):
  GET  /health
  GET  /v1/models
  POST /v1/chat/completions   (OpenAI format, image_url data URLs, stream:true -> SSE)
  POST /v1/images/generations (prompt, negative_prompt, width, height, steps, guidance, seed)

Engine choice (chat): llama.cpp `llama-server` with Qwen3-VL GGUF + mmproj.
  * Works on Turing/Pascal (T4 / P100): GGUF quants are fp16-compute, no bf16 needed.
    vLLM / transformers paths want bf16 or hit fp16 overflow issues on T4, and vLLM
    needs newer GPUs (compute capability >= 7.5 and recent wheels) plus a lot of VRAM.
  * Same GGUF family the Android app already uses, so behaviour matches the on-phone model.
  * Native vision support (--mmproj) and an OpenAI-compatible SSE API, which we proxy.
  * Separate process => the VRAM is really freed when we kill it (needed for the swap).
Engine choice (images): diffusers StableDiffusionXLPipeline, SDXL base 1.0 in fp16 with the
  fp16-fix VAE (the stock SDXL VAE gives black images in fp16). OpenRAIL++-M license, general
  purpose, ~7 GB, no bf16 needed. Override with IMAGE_MODEL (any SDXL-format diffusers repo).

VRAM strategy (env GPU_MODE=auto|split|swap):
  split: >=2 GPUs. llama-server pinned to GPU 0, diffusers on GPU 1. Both stay resident.
  swap : 1 GPU. Only one model on the GPU at a time; switched automatically per request
         (chat model process is stopped for image requests and restarted for chat requests).
"""
import asyncio
import base64
import gc
import io
import json
import os
import secrets
import shutil
import subprocess
import sys
import time
from contextlib import asynccontextmanager, nullcontext

import httpx
import uvicorn
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

# ---------------------------------------------------------------- config
API_KEY = os.environ.get("API_KEY", "").strip()
PORT = int(os.environ.get("PORT", "8000"))
LLAMA_PORT = int(os.environ.get("LLAMA_PORT", "8081"))
LLAMA_BIN = os.environ.get("LLAMA_SERVER_BIN", "llama-server")
CHAT_MODEL = os.environ.get("CHAT_MODEL", "")      # path to .gguf
CHAT_MMPROJ = os.environ.get("CHAT_MMPROJ", "")    # path to mmproj .gguf
CHAT_CTX = int(os.environ.get("CHAT_CTX", "8192"))
CHAT_NAME = os.environ.get("CHAT_NAME", "qwen3-vl")
LLAMA_EXTRA = os.environ.get("LLAMA_EXTRA_ARGS", "")  # e.g. "--image-max-tokens 1024"
IMAGE_MODEL = os.environ.get("IMAGE_MODEL", "stabilityai/stable-diffusion-xl-base-1.0")
IMAGE_VAE = os.environ.get("IMAGE_VAE", "madebyollin/sdxl-vae-fp16-fix")
IMAGE_KEEP_CPU = os.environ.get("IMAGE_KEEP_CPU", "0") == "1"  # swap mode: park pipe in RAM
GPU_MODE = os.environ.get("GPU_MODE", "auto")
LOG_DIR = os.environ.get("LOG_DIR", ".")
MAX_PIXELS = int(os.environ.get("MAX_IMAGE_PIXELS", str(1536 * 1536)))


def gpu_count() -> int:
    try:
        out = subprocess.run(["nvidia-smi", "-L"], capture_output=True, text=True, timeout=15).stdout
        return sum(1 for l in out.splitlines() if l.startswith("GPU "))
    except Exception:
        return 0


N_GPUS = gpu_count()
MODE = GPU_MODE if GPU_MODE in ("split", "swap") else ("split" if N_GPUS >= 2 else "swap")
IMG_DEVICE = "cuda:1" if MODE == "split" else "cuda:0"


def log(*a):
    print(time.strftime("[%H:%M:%S]"), *a, file=sys.stderr, flush=True)


# ---------------------------------------------------------------- auth
def require_key(request: Request):
    h = request.headers.get("authorization", "")
    tok = h[7:].strip() if h.lower().startswith("bearer ") else ""
    if not API_KEY or not secrets.compare_digest(tok.encode(), API_KEY.encode()):
        raise HTTPException(status_code=401, detail="invalid api key")


# ---------------------------------------------------------------- GPU manager
class Gpu:
    def __init__(self):
        self.proc = None            # llama-server subprocess
        self.pipe = None            # diffusers pipeline
        self.pipe_on_gpu = False
        self.state_lock = asyncio.Lock()   # guards load/unload transitions
        # swap mode: one request at a time uses the GPU (held for the whole stream)
        self.gpu_lock = asyncio.Lock()
        self.img_lock = asyncio.Lock()
        self.http = httpx.AsyncClient(timeout=httpx.Timeout(600.0, connect=10.0))

    # ---- chat model process
    def llama_alive(self):
        return self.proc is not None and self.proc.poll() is None

    async def start_llama(self):
        if self.llama_alive():
            return
        if not CHAT_MODEL or not os.path.exists(CHAT_MODEL):
            raise HTTPException(500, f"CHAT_MODEL not found: {CHAT_MODEL!r}")
        cmd = [LLAMA_BIN, "-m", CHAT_MODEL, "-c", str(CHAT_CTX), "-ngl", "99",
               "--host", "127.0.0.1", "--port", str(LLAMA_PORT), "-np", "1", "--jinja",
               "--alias", CHAT_NAME]
        if CHAT_MMPROJ and os.path.exists(CHAT_MMPROJ):
            cmd += ["--mmproj", CHAT_MMPROJ]
        if LLAMA_EXTRA:
            cmd += LLAMA_EXTRA.split()
        env = dict(os.environ)
        if MODE == "split":
            env["CUDA_VISIBLE_DEVICES"] = "0"
        log("starting llama-server:", " ".join(cmd))
        logf = open(os.path.join(LOG_DIR, "llama-server.log"), "ab")
        self.proc = subprocess.Popen(cmd, stdout=logf, stderr=subprocess.STDOUT, env=env)
        t0 = time.time()
        while time.time() - t0 < 600:
            if self.proc.poll() is not None:
                raise HTTPException(500, "llama-server exited, see llama-server.log")
            try:
                r = await self.http.get(f"http://127.0.0.1:{LLAMA_PORT}/health", timeout=5)
                if r.status_code == 200:
                    log(f"llama-server ready in {time.time()-t0:.0f}s")
                    return
            except Exception:
                pass
            await asyncio.sleep(1.5)
        self.stop_llama()
        raise HTTPException(500, "llama-server start timeout")

    def stop_llama(self):
        if self.proc is not None:
            log("stopping llama-server")
            try:
                self.proc.terminate()
                self.proc.wait(timeout=20)
            except Exception:
                self.proc.kill()
                self.proc.wait()
            self.proc = None

    # ---- image pipeline
    def _load_pipe_sync(self):
        import torch
        from diffusers import AutoencoderKL, DPMSolverMultistepScheduler, StableDiffusionXLPipeline
        log("loading image model", IMAGE_MODEL)
        kw = dict(torch_dtype=torch.float16, use_safetensors=True)
        try:
            vae = AutoencoderKL.from_pretrained(IMAGE_VAE, torch_dtype=torch.float16)
            kw["vae"] = vae
        except Exception as e:  # keep going, but fp16 VAE may produce black images
            log("VAE load failed, using the model's own VAE:", e)
        try:
            pipe = StableDiffusionXLPipeline.from_pretrained(IMAGE_MODEL, variant="fp16", **kw)
        except Exception:
            pipe = StableDiffusionXLPipeline.from_pretrained(IMAGE_MODEL, **kw)
        pipe.scheduler = DPMSolverMultistepScheduler.from_config(
            pipe.scheduler.config, algorithm_type="sde-dpmsolver++", use_karras_sigmas=True)
        pipe.set_progress_bar_config(disable=True)
        try:
            pipe.vae.enable_tiling()  # keeps VAE decode memory low for big images
        except Exception:
            pass
        self.pipe = pipe

    def _pipe_to_gpu_sync(self):
        if self.pipe is None:
            self._load_pipe_sync()
        if not self.pipe_on_gpu:
            self.pipe.to(IMG_DEVICE)
            self.pipe_on_gpu = True

    def _free_pipe_sync(self):
        import torch
        if self.pipe is not None:
            if IMAGE_KEEP_CPU and MODE == "swap":
                self.pipe.to("cpu")
            else:
                self.pipe = None
            self.pipe_on_gpu = False
        gc.collect()
        torch.cuda.empty_cache()

    async def ensure_chat(self):
        async with self.state_lock:
            if MODE == "swap" and self.pipe_on_gpu:
                await asyncio.to_thread(self._free_pipe_sync)
            await self.start_llama()

    async def ensure_image(self):
        async with self.state_lock:
            if MODE == "swap" and self.llama_alive():
                await asyncio.to_thread(self.stop_llama)
                await asyncio.sleep(2)  # let the driver release VRAM
            await asyncio.to_thread(self._pipe_to_gpu_sync)

    def chat_guard(self):
        return self.gpu_lock if MODE == "swap" else nullcontext()

    def image_guard(self):
        return self.gpu_lock if MODE == "swap" else self.img_lock


gpu = Gpu()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not API_KEY:
        raise RuntimeError("Set the API_KEY environment variable")
    log(f"GPUs={N_GPUS} mode={MODE} image_device={IMG_DEVICE}")

    async def prewarm():
        try:
            await gpu.ensure_chat()
        except Exception as e:
            log("prewarm failed:", e)
    asyncio.create_task(prewarm())
    yield
    gpu.stop_llama()
    await gpu.http.aclose()


app = FastAPI(title="Vision Chat cloud", lifespan=lifespan)


# ---------------------------------------------------------------- routes
@app.get("/health")
async def health():
    state = "image" if gpu.pipe_on_gpu else ("chat" if gpu.llama_alive() else "idle")
    return {"status": "ok", "mode": MODE, "gpus": N_GPUS, "gpu_state": state,
            "chat_model": CHAT_NAME, "image_model": IMAGE_MODEL}


@app.get("/v1/models", dependencies=[Depends(require_key)])
async def models():
    return {"object": "list", "data": [
        {"id": CHAT_NAME, "object": "model", "owned_by": "local"},
        {"id": "image", "object": "model", "owned_by": "local"}]}


def _err(status, msg):
    return JSONResponse({"error": {"message": msg, "type": "server_error"}}, status_code=status)


@app.post("/v1/chat/completions", dependencies=[Depends(require_key)])
async def chat(request: Request):
    try:
        body = await request.json()
    except Exception:
        return _err(400, "invalid JSON")
    body["model"] = CHAT_NAME
    stream = bool(body.get("stream"))
    url = f"http://127.0.0.1:{LLAMA_PORT}/v1/chat/completions"

    if not stream:
        async with gpu.chat_guard():
            try:
                await gpu.ensure_chat()
                r = await gpu.http.post(url, json=body)
            except HTTPException as e:
                return _err(e.status_code, str(e.detail))
            except Exception as e:
                return _err(502, f"chat backend error: {e}")
        return JSONResponse(r.json() if r.content else {}, status_code=r.status_code)

    async def gen():
        async with gpu.chat_guard():
            try:
                await gpu.ensure_chat()
                async with gpu.http.stream("POST", url, json=body) as r:
                    if r.status_code != 200:
                        msg = (await r.aread()).decode("utf-8", "replace")[:500]
                        yield f"data: {json.dumps({'error': {'message': msg}})}\n\n".encode()
                        yield b"data: [DONE]\n\n"
                        return
                    async for chunk in r.aiter_raw():
                        yield chunk
            except HTTPException as e:
                yield f"data: {json.dumps({'error': {'message': str(e.detail)}})}\n\n".encode()
                yield b"data: [DONE]\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': {'message': str(e)}})}\n\n".encode()
                yield b"data: [DONE]\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


class ImageReq(BaseModel):
    prompt: str
    negative_prompt: str = ""
    width: int = 1024
    height: int = 1024
    steps: int = Field(25, ge=1, le=60)
    guidance: float = Field(6.0, ge=0.0, le=20.0)
    seed: int = -1          # explicit int; -1 = random
    n: int = Field(1, ge=1, le=4)
    model: str | None = None
    response_format: str | None = None  # ignored: always b64_json


def _generate_sync(req: ImageReq):
    import torch
    w = max(256, min(2048, req.width)) // 8 * 8
    h = max(256, min(2048, req.height)) // 8 * 8
    while w * h > MAX_PIXELS:  # keep memory/time bounded, preserve aspect
        w, h = max(256, (w * 9 // 10) // 8 * 8), max(256, (h * 9 // 10) // 8 * 8)
    seed = req.seed if req.seed >= 0 else int.from_bytes(os.urandom(4), "little")
    out, seeds = [], []
    for i in range(req.n):
        s = (seed + i) % (2**32)
        g = torch.Generator(device=IMG_DEVICE).manual_seed(s)
        img = gpu.pipe(prompt=req.prompt, negative_prompt=req.negative_prompt or None,
                       width=w, height=h, num_inference_steps=req.steps,
                       guidance_scale=req.guidance, generator=g).images[0]
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        out.append(base64.b64encode(buf.getvalue()).decode())
        seeds.append(s)
    return out, seeds, w, h


@app.post("/v1/images/generations", dependencies=[Depends(require_key)])
async def images(req: ImageReq):
    async with gpu.image_guard():
        try:
            await gpu.ensure_image()
            b64s, seeds, w, h = await asyncio.to_thread(_generate_sync, req)
        except HTTPException as e:
            return _err(e.status_code, str(e.detail))
        except Exception as e:
            log("image error:", repr(e))
            return _err(500, f"image generation failed: {e}")
    return {"created": int(time.time()),
            "data": [{"b64_json": b, "seed": s} for b, s in zip(b64s, seeds)],
            "width": w, "height": h}


if __name__ == "__main__":
    if not API_KEY:
        sys.exit("Set the API_KEY environment variable")
    if shutil.which(LLAMA_BIN) is None and not os.path.exists(LLAMA_BIN):
        log("WARNING: llama-server binary not found:", LLAMA_BIN)
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info", timeout_keep_alive=120)
