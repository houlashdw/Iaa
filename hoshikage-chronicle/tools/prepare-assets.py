#!/usr/bin/env python3
"""Turns the downloaded npm packages (.cache/src) into the compact asset set the game loads (assets/).

Nothing here draws anything: every pixel comes from a real image file of the source packs; this script
only crops / resizes / re-encodes them (and cuts face thumbnails out of the painted character art).
"""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / ".cache" / "src"
OUT = ROOT / "assets"

PACKS = {
    "heroes": SRC / "sprite-foundry__fantasy-heroes-hd" / "assets",
    "villains": SRC / "sprite-foundry__fantasy-villains-hd" / "assets",
    "goblins": SRC / "sprite-foundry__goblin-warband-hd" / "assets",
    "pirates": SRC / "sprite-foundry__pirate-raiders-hd" / "assets",
    "towns": SRC / "sprite-foundry__townsfolk-hd" / "assets",
}
NF = SRC / "netforge__asset-library-files" / "library"

# playable characters -> (pack, variant)
PARTY = {
    "haru": ("towns", "child"),
    "airi": ("heroes", "white_mage"),
    "ren": ("heroes", "samurai"),
    "daigo": ("heroes", "monk"),
    "sylva": ("heroes", "ranger"),
    "zeno": ("heroes", "sorcerer"),
}
PARTY_SRC = set(PARTY.values())

# enemies that also need a big "front" portrait (bosses / talking villains)
BIG_ENEMIES = {
    "villains": None,  # all of them
    "goblins": {"warchief", "elder", "shaman", "brute", "merchant"},
    "pirates": {"captain", "first-mate", "sea-witch", "quartermaster", "stormcaller", "juggernaut",
                "tide-cultist", "navigator", "swashbuckler"},
}

MODELS = [
    "tree_oak", "tree_pine", "tree_pine_tall", "tree_autumn", "tree_dark", "tree_fat", "tree_palm",
    "bush", "bush_large", "rock_large", "rock_small", "rock_tall", "log", "stump", "flower_red",
    "mushroom_red", "pumpkin", "fence", "tent", "campfire", "crate", "barrel", "barrels", "chest",
    "column", "column_broken", "obelisk", "crystal", "crystal_rock", "gem_pink", "sword", "greatsword",
    "fish", "cargo_ship",
]
TEXTURES = ["grass", "stone", "dirt", "wood", "wall", "bark", "gravel", "plate", "metal", "concrete"]


def bleed(img, passes=6):
    """Spread edge colours into the fully transparent area so bilinear filtering never shows dark halos."""
    import numpy as np
    a = np.asarray(img.convert("RGBA")).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3:] / 255.0
    known = (al > 0.02).astype(np.float32)
    filled = rgb * known
    for _ in range(passes):
        # 3x3 box average of known colours, only written where nothing is known yet
        k = np.pad(known, ((1, 1), (1, 1), (0, 0)))
        f = np.pad(filled, ((1, 1), (1, 1), (0, 0)))
        ks = sum(k[1 + dy:1 + dy + known.shape[0], 1 + dx:1 + dx + known.shape[1]] for dy in (-1, 0, 1) for dx in (-1, 0, 1))
        fs = sum(f[1 + dy:1 + dy + known.shape[0], 1 + dx:1 + dx + known.shape[1]] for dy in (-1, 0, 1) for dx in (-1, 0, 1))
        new = (ks > 0) & (known == 0)
        filled = np.where(new, fs / np.maximum(ks, 1), filled)
        known = np.maximum(known, new.astype(np.float32))
    out = np.where(al > 0.02, rgb, filled)
    res = np.concatenate([out, a[..., 3:]], axis=2).clip(0, 255).astype(np.uint8)
    return Image.fromarray(res, "RGBA")


def save_webp(img, path, q=84):
    path.parent.mkdir(parents=True, exist_ok=True)
    if img.mode == "RGBA":
        img = bleed(img)
    img.save(path, "WEBP", quality=q, method=6, alpha_quality=92, exact=True)


def load(pack, variant, view):
    return Image.open(PACKS[pack] / variant / "albedo" / f"{view}.png").convert("RGBA")


# characters holding something above their head fool the silhouette heuristic: (centre x, centre y, size) in 512px space
FACE_OVERRIDES = {
    "goblins_banner_bearer": (274, 140, 130), "goblins_brute": (228, 52, 120), "goblins_cook": (232, 124, 112),
    "goblins_shaman": (274, 92, 120), "goblins_firebrand": (252, 110, 120), "goblins_slinger": (240, 100, 120),
    "towns_guard": (244, 52, 104), "villains_blackguard": (272, 56, 120), "villains_necromancer": (266, 78, 130),
    "villains_reaver": (250, 84, 110), "villains_warlord": (262, 56, 110), "villains_cult_priest": (224, 72, 110),
}


def face_from_box(front, cx, cy, s):
    left, top = int(cx - s / 2), int(cy - s / 2)
    canvas = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    canvas.alpha_composite(front.crop((max(left, 0), max(top, 0), min(left + s, 512), min(top + s, 512))),
                           (max(-left, 0), max(-top, 0)))
    return canvas.resize((128, 128), Image.LANCZOS)


def face_crop(front):
    """Square crop around the head of a 512px front view, 128px output."""
    a = front.getchannel("A")
    bbox = a.getbbox()
    if not bbox:
        return front.resize((128, 128))
    x0, y0, x1, y1 = bbox
    h = y1 - y0
    # centroid of the top 14% of the silhouette ~ the head (ignores weapons held out sideways)
    band = a.crop((0, y0, 512, y0 + int(h * 0.14)))
    px = band.load()
    sx = sw = 0
    for y in range(band.height):
        for x in range(band.width):
            v = px[x, y]
            if v > 40:
                sx += x * v
                sw += v
    cx = sx / sw if sw else (x0 + x1) / 2
    s = int(h * 0.27)
    left = int(cx - s / 2)
    top = int(y0 - h * 0.025)
    canvas = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    canvas.alpha_composite(front.crop((max(left, 0), max(top, 0), min(left + s, 512), min(top + s, 512))),
                           (max(-left, 0), max(-top, 0)))
    return canvas.resize((128, 128), Image.LANCZOS)


def key_of(pack, variant):
    return f"{pack}_{variant}".replace("-", "_")


def main():
    if not SRC.exists():
        sys.exit("run tools/fetch-assets.sh first")
    if OUT.exists():
        # keep the hand-maintained licence texts, regenerate everything else
        for child in OUT.iterdir():
            if child.name == "LICENSES":
                continue
            shutil.rmtree(child) if child.is_dir() else child.unlink()
    manifest = {"party": {}, "chars": {}, "models": [], "textures": [], "sfx": [], "music": []}

    # --- playable characters: 4 views + portrait + face
    for key, (pack, variant) in PARTY.items():
        front = load(pack, variant, "front")
        save_webp(front, OUT / "sprites" / f"{key}.webp", 86)
        save_webp(face_crop(front), OUT / "faces" / f"{key}.webp", 88)
        for view, suffix in (("back", "back"), ("right", "right"), ("front_left", "fl")):
            im = load(pack, variant, view).resize((320, 320), Image.LANCZOS)
            save_webp(im, OUT / "sprites" / f"{key}_{suffix}.webp", 84)
        manifest["party"][key] = {"src": f"{pack}/{variant}"}

    # --- everyone else
    def add_char(pack, variant, big, battle):
        key = key_of(pack, variant)
        front = load(pack, variant, "front")
        if big:
            save_webp(front, OUT / "sprites" / f"{key}.webp", 84)
        else:
            save_webp(front.resize((384, 384), Image.LANCZOS), OUT / "sprites" / f"{key}.webp", 82)
        face = face_from_box(front, *FACE_OVERRIDES[key]) if key in FACE_OVERRIDES else face_crop(front)
        save_webp(face, OUT / "faces" / f"{key}.webp", 86)
        if battle:
            im = load(pack, variant, "front_left").resize((300, 300), Image.LANCZOS)
            save_webp(im, OUT / "sprites" / f"{key}_fl.webp", 82)
        manifest["chars"][key] = {"src": f"{pack}/{variant}", "battle": battle, "big": big}

    for pack, base in PACKS.items():
        for variant in sorted(p.name for p in base.iterdir() if p.is_dir()):
            if (pack, variant) in PARTY_SRC:
                continue
            if pack in ("towns", "heroes"):
                add_char(pack, variant, big=True, battle=pack == "heroes")
            else:
                sel = BIG_ENEMIES[pack]
                big = sel is None or variant in sel
                add_char(pack, variant, big=big, battle=True)

    # --- 3D props (CC0 low-poly GLB, meshopt) + surface textures
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
        shutil.copy(NF / "ps1" / f"surface_{t}.png", OUT / "tex" / f"{t}.png")
        manifest["textures"].append(t)

    # --- audio
    (OUT / "audio").mkdir(parents=True, exist_ok=True)
    # sound effects ship as Ogg Vorbis; re-encode to MP3 because Safari / iOS cannot decode Ogg
    for f in sorted((NF / "audio" / "sfx").glob("*.ogg")):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(f), "-ac", "1", "-b:a", "96k",
                        str(OUT / "audio" / (f.stem + ".mp3"))], check=True)
        manifest["sfx"].append(f.stem)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(NF / "audio" / "music" / "battle_theme_a.mp3"),
                    "-ac", "2", "-b:a", "112k", str(OUT / "audio" / "battle_theme_a.mp3")], check=True)
    manifest["music"].append("battle_theme_a")

    # --- fonts (OFL)
    (OUT / "fonts").mkdir(parents=True, exist_ok=True)
    for pkg, names in (("fontsource__zen-maru-gothic", ["zen-maru-gothic-latin-400-normal.woff2", "zen-maru-gothic-latin-700-normal.woff2"]),
                       ("fontsource__cinzel", ["cinzel-latin-600-normal.woff2", "cinzel-latin-700-normal.woff2"])):
        for n in names:
            shutil.copy(SRC / pkg / "files" / n, OUT / "fonts" / n)

    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))
    total = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file())
    print(f"assets: {sum(1 for _ in OUT.rglob('*') if _.is_file())} files, {total/1e6:.1f} MB")


if __name__ == "__main__":
    main()
