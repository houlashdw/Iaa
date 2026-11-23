#!/usr/bin/env python3
"""Builds the compact asset set the game loads (assets/) from the downloaded packages.

Everything visible comes from real files:
  * characters ........ VRoid CC0 anime avatars (.vrm, optimized by tools/optimize-vrm.py) + rigged CC0 GLB creatures
  * world props ....... CC0 low-poly GLB props, PS1-style surface textures
  * audio ............. CC0 effects + music (re-encoded to MP3, loudness-normalised)
This script only copies / re-encodes; it draws nothing.
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / ".cache" / "src"
OUT = ROOT / "assets"
NF = SRC / "netforge__asset-library-files" / "library"
VRM_OPT = ROOT / ".cache" / "vrm_opt"

# keep in sync with src/data/cast.js
CHAR_VRM = ["base_male", "sakurada", "sample_g", "sample_f", "sample_e", "sample_d", "sample_d_dark", "sendagaya"]
CHAR_GLB = ["orc_brute", "skeleton", "ghost", "demon", "frog", "wolf_cartoon"]
MODELS = [
    "tree_oak", "tree_pine", "tree_pine_tall", "tree_autumn", "tree_dark", "tree_fat", "tree_palm",
    "bush", "bush_large", "rock_large", "rock_small", "rock_tall", "log", "stump", "flower_red",
    "mushroom_red", "pumpkin", "fence", "tent", "campfire", "crate", "barrel", "barrels", "chest",
    "column", "column_broken", "obelisk", "crystal", "crystal_rock", "gem_pink", "sword", "greatsword",
    "fish", "cargo_ship",
]
TEXTURES = ["grass", "stone", "dirt", "wood", "wall", "bark", "gravel", "plate", "metal", "concrete"]
MUSIC_FILES = (("town", "town.mp3"), ("cave", "cave.mp3"), ("title", "title.mp3"), ("castle", "castle.mp3"),
               ("boss_theme", "boss_theme.wav"), ("final_boss", "final_boss.mp3"))


# per-surface softness (blur radius at 512 px): the PS1 sources are dithered pixel art, so they are turned into
# soft painted surfaces - heavy softening for ground, light for brick / tile structure
PAINT = {"grass": 5.5, "dirt": 4.5, "gravel": 7.0, "concrete": 9.0, "stone": 2.4, "wall": 2.6, "plate": 2.2, "wood": 3.0,
         "bark": 3.2, "metal": 5.0}


def paint(src, dst, blur):
    """tile-safe upscale to 512, soften, lift colour; the result is still the original texture's art"""
    im = Image.open(src).convert("RGB")
    w, h = im.size
    k = 512 // w
    big = Image.new("RGB", (w * 3, h * 3))
    for i in range(3):
        for j in range(3):
            big.paste(im, (i * w, j * h))
    big = big.resize((w * 3 * k, h * 3 * k), Image.BICUBIC).filter(ImageFilter.MedianFilter(2 * k + 1))
    big = big.filter(ImageFilter.GaussianBlur(blur))
    big = ImageEnhance.Color(big).enhance(1.18)
    big = ImageEnhance.Contrast(big).enhance(1.25 if blur > 4 else 1.1)
    big.crop((w * k, h * k, 2 * w * k, 2 * h * k)).save(dst, "WEBP", quality=88, method=6)


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], check=True)


def main():
    if not SRC.exists():
        sys.exit("run tools/fetch-assets.sh first")
    if OUT.exists():
        for child in OUT.iterdir():  # keep the hand-maintained licence texts
            if child.name == "LICENSES":
                continue
            shutil.rmtree(child) if child.is_dir() else child.unlink()
    manifest = {"chars": [], "models": [], "textures": [], "sfx": [], "music": []}

    # --- characters
    (OUT / "chars").mkdir(parents=True, exist_ok=True)
    for n in CHAR_VRM:
        src = VRM_OPT / f"{n}.vrm"
        if not src.exists():
            sys.exit(f"missing {src} - run tools/fetch-vrm.sh && python3 tools/optimize-vrm.py")
        shutil.copy(src, OUT / "chars" / f"{n}.vrm")
        manifest["chars"].append(f"{n}.vrm")
    for n in CHAR_GLB:
        shutil.copy(NF / "lowpoly" / f"{n}.glb", OUT / "chars" / f"{n}.glb")
        manifest["chars"].append(f"{n}.glb")

    # --- world props + surface textures
    (OUT / "models").mkdir(parents=True, exist_ok=True)
    for m in MODELS:
        src = NF / "lowpoly" / f"{m}.glb"
        if not src.exists():
            print("missing model", m)
            continue
        shutil.copy(src, OUT / "models" / f"{m}.glb")
        manifest["models"].append(m)
    (OUT / "tex").mkdir(parents=True, exist_ok=True)
    for t in TEXTURES:
        paint(NF / "ps1" / f"surface_{t}.png", OUT / "tex" / f"{t}.webp", PAINT.get(t, 3.0))
        manifest["textures"].append(t)

    # --- audio: effects ship as Ogg; re-encode to MP3 (Safari/iOS cannot decode Ogg)
    (OUT / "audio").mkdir(parents=True, exist_ok=True)
    for f in sorted((NF / "audio" / "sfx").glob("*.ogg")):
        ffmpeg("-i", str(f), "-ac", "1", "-b:a", "96k", str(OUT / "audio" / (f.stem + ".mp3")))
        manifest["sfx"].append(f.stem)
    tracks = {"battle_theme_a": NF / "audio" / "music" / "battle_theme_a.mp3"}
    MUSIC = ROOT / ".cache" / "music"  # filled by tools/fetch-music.sh (CC0 tracks from OpenGameArt)
    for name, fname in MUSIC_FILES:
        if (MUSIC / fname).exists():
            tracks[name] = MUSIC / fname
        else:
            print("music track missing (run tools/fetch-music.sh):", name)
    for name, src in tracks.items():  # loudness-normalised so one volume setting fits all
        ffmpeg("-i", str(src), "-af", "loudnorm=I=-18:TP=-1.5:LRA=11", "-ac", "2", "-ar", "44100", "-b:a", "80k",
               str(OUT / "audio" / f"{name}.mp3"))
        manifest["music"].append(name)

    # --- fonts (OFL)
    (OUT / "fonts").mkdir(parents=True, exist_ok=True)
    for pkg, names in (("fontsource__zen-maru-gothic", ["zen-maru-gothic-latin-400-normal.woff2", "zen-maru-gothic-latin-700-normal.woff2"]),
                       ("fontsource__cinzel", ["cinzel-latin-600-normal.woff2", "cinzel-latin-700-normal.woff2"])):
        for n in names:
            shutil.copy(SRC / pkg / "files" / n, OUT / "fonts" / n)

    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))
    total = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file())
    print(f"assets: {sum(1 for _ in OUT.rglob('*') if _.is_file())} files, {total / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
