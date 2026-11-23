#!/usr/bin/env python3
"""Shrinks the CC0 VRoid VRM models (14-21 MB each) to ~2 MB so the whole cast fits in the game.

* every texture is downscaled (max 512 px, 128 px for normal/matcap maps) and re-encoded as WebP
* facial morph targets (blend shapes) are dropped - the game poses bones only
* unused accessors / buffer views are removed and the BIN chunk is rebuilt

Output: .cache/vrm_opt/<name>.vrm (copied into assets/chars by prepare-assets.py) (still a valid VRM 0.x / glTF binary).
"""
import io
import json
import struct
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / ".cache" / "vrm"
OUT = ROOT / ".cache" / "vrm_opt"

MODELS = {  # output name -> source file
    "base_female": "Base_Female.vrm", "base_male": "Base_Male.vrm", "sample_d": "AvatarSample_D.vrm",
    "sample_d_dark": "AvatarSample_D_Darkness.vrm", "sample_e": "AvatarSample_E.vrm", "sample_f": "AvatarSample_F.vrm",
    "sample_g": "AvatarSample_G.vrm", "sakurada": "Sakurada Fumiriya.vrm", "sendagaya": "Sendagaya Shino.vrm",
}


def read_glb(path):
    b = path.read_bytes()
    assert b[:4] == b"glTF"
    off, js, bn = 12, None, None
    while off < len(b):
        ln, tp = struct.unpack("<II", b[off:off + 8])
        d = b[off + 8:off + 8 + ln]
        off += 8 + ln
        if tp == 0x4E4F534A:
            js = json.loads(d)
        elif tp == 0x004E4942:
            bn = d
    return js, bn


def write_glb(js, bn):
    j = json.dumps(js, separators=(",", ":")).encode()
    j += b" " * ((4 - len(j) % 4) % 4)
    bn += b"\0" * ((4 - len(bn) % 4) % 4)
    total = 12 + 8 + len(j) + 8 + len(bn)
    return b"glTF" + struct.pack("<II", 2, total) + struct.pack("<II", len(j), 0x4E4F534A) + j + struct.pack("<II", len(bn), 0x004E4942) + bn


def shrink_image(data, name):
    im = Image.open(io.BytesIO(data))
    small = any(k in (name or "") for k in ("_nml", "Matcap", "Shader_", "_out", "Rim"))
    limit = 128 if small else 512
    if max(im.size) > limit:
        r = limit / max(im.size)
        im = im.resize((max(1, round(im.width * r)), max(1, round(im.height * r))), Image.LANCZOS)
    if im.mode not in ("RGB", "RGBA"):
        im = im.convert("RGBA")
    out = io.BytesIO()
    im.save(out, "WEBP", quality=80, method=6, alpha_quality=100)
    return out.getvalue()


def optimize(src, dst):
    js, bn = read_glb(src)
    bvs = js["bufferViews"]
    # 1. drop morph targets + blend-shape binds
    for m in js["meshes"]:
        for p in m["primitives"]:
            p.pop("targets", None)
        m.pop("weights", None)
        if "extras" in m:
            m["extras"].pop("targetNames", None)
    vrm = js.get("extensions", {}).get("VRM")
    if vrm:
        for g in vrm.get("blendShapeMaster", {}).get("blendShapeGroups", []):
            g["binds"] = []
    # 2. which accessors / buffer views survive
    used_acc = set()
    for m in js["meshes"]:
        for p in m["primitives"]:
            used_acc.update(p["attributes"].values())
            if "indices" in p:
                used_acc.add(p["indices"])
    for s in js.get("skins", []):
        if "inverseBindMatrices" in s:
            used_acc.add(s["inverseBindMatrices"])
    used_bv = set()
    for a in used_acc:
        A = js["accessors"][a]
        if "bufferView" in A:
            used_bv.add(A["bufferView"])
        sp = A.get("sparse")
        if sp:
            used_bv.add(sp["indices"]["bufferView"]); used_bv.add(sp["values"]["bufferView"])
    for im in js["images"]:
        used_bv.add(im["bufferView"])
    # 3. new image bytes
    replaced = {}
    for im in js["images"]:
        bv = bvs[im["bufferView"]]
        data = bn[bv.get("byteOffset", 0):bv.get("byteOffset", 0) + bv["byteLength"]]
        replaced[im["bufferView"]] = shrink_image(data, im.get("name"))
        im["mimeType"] = "image/webp"
    # 4. rebuild BIN + remap indices
    new_bn = bytearray()
    bv_map, new_bvs = {}, []
    for old in sorted(used_bv):
        bv = dict(bvs[old])
        data = replaced.get(old, bn[bv.get("byteOffset", 0):bv.get("byteOffset", 0) + bv["byteLength"]])
        while len(new_bn) % 4:
            new_bn.append(0)
        bv["byteOffset"] = len(new_bn)
        bv["byteLength"] = len(data)
        new_bn += data
        bv_map[old] = len(new_bvs)
        new_bvs.append(bv)
    acc_map, new_acc = {}, []
    for old in sorted(used_acc):
        A = json.loads(json.dumps(js["accessors"][old]))
        if "bufferView" in A:
            A["bufferView"] = bv_map[A["bufferView"]]
        if "sparse" in A:
            A["sparse"]["indices"]["bufferView"] = bv_map[A["sparse"]["indices"]["bufferView"]]
            A["sparse"]["values"]["bufferView"] = bv_map[A["sparse"]["values"]["bufferView"]]
        acc_map[old] = len(new_acc)
        new_acc.append(A)
    for m in js["meshes"]:
        for p in m["primitives"]:
            p["attributes"] = {k: acc_map[v] for k, v in p["attributes"].items()}
            if "indices" in p:
                p["indices"] = acc_map[p["indices"]]
    for s in js.get("skins", []):
        if "inverseBindMatrices" in s:
            s["inverseBindMatrices"] = acc_map[s["inverseBindMatrices"]]
    for im in js["images"]:
        im["bufferView"] = bv_map[im["bufferView"]]
    js["bufferViews"], js["accessors"] = new_bvs, new_acc
    js["buffers"] = [{"byteLength": len(new_bn)}]
    dst.write_bytes(write_glb(js, bytes(new_bn)))
    return len(dst.read_bytes())


def main():
    if not SRC.exists():
        sys.exit("run tools/fetch-vrm.sh first")
    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for name, fn in MODELS.items():
        s = SRC / fn
        if not s.exists():
            print("missing", fn)
            continue
        n = optimize(s, OUT / f"{name}.vrm")
        total += n
        print(f"{name:14} {s.stat().st_size / 1e6:5.1f} MB -> {n / 1e6:4.2f} MB")
    print(f"total {total / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
