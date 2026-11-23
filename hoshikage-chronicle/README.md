# Hoshikage Chronicle  星影

**A 3D anime action‑RPG that runs in your browser.** Real 3D cel‑shaded anime characters (VRoid models) in a lit 3D world,
seen over the shoulder with a free camera. Combat is **real‑time** (no turns): roaming enemies, attack combos, five skills per
hero, dodge rolls, a Star‑Burst ultimate, and a party you can swap between on the fly. A prologue plus five chapters,
six playable heroes, an estimated **1–1.5 hours** of play (estimate from content size — not timed with human players yet).

> **Play it:** open **`dist/hoshikage-chronicle.html`** in Chrome / Edge / Firefox / Safari.
> It is *one self‑contained file* (≈30 MB): code, CSS, fonts and every 3D model, texture, song and sound are embedded.
> No server, no install, no internet needed.

## Story

On the Night of Falling Stars the Moon shatters. Haru — a village boy with a straw hat and a wooden sword —
is chosen as Bearer of the Moon Shards. With a priestess, a ronin, a monk, a ranger and a court sorcerer he
crosses five regions to mend the sky:

| Chapter | Place | Boss | Joins |
|---|---|---|---|
| Prologue | Hinode Village (night) | goblin pups | — |
| 1 | Whispering Woods → Goblin Camp | Warchief Gruk | **Airi** (Moon priestess) |
| 2 | Ashen Shrine | Ren the Ronin → Bandit King Gorou | **Ren** (samurai) |
| 3 | Port Namiji & Lighthouse | Captain Redtide | **Daigo** (monk) |
| 4 | Crystal Caverns | Mordo → Gorgon Queen Stheno | **Sylva** (ranger) |
| 5 | Moonlit Castle | Vael, Kazan, Lord Kurohane, **the Hollow Sovereign** | **Zeno** (sorcerer) |

## Controls

| | |
|---|---|
| Move / sprint | `WASD` / `Shift` · phones: floating stick on the left (push to the rim to sprint) |
| Camera | mouse (click the game once to capture it, `Esc` releases) · or arrow keys · touch: drag the right side |
| Attack (combo) | left click / `J` (hold to keep attacking) |
| Skills | `1`–`5` — each hero has five skill slots that unlock as they level |
| Dodge roll | `Space` / right click — dodge **just before** a hit for a *Perfect Dodge* (slow‑mo + Star gauge) |
| Star Burst | `R` when the ★ gauge is full (it fills as you fight) |
| Switch hero | `Tab` / `Q`, or click a portrait — the others fight on their own (AI) |
| Quick heal item | `H` · Auto‑battle toggle `T` |
| Talk / open | `E` / `F` · Menu `M` / `Esc` (items, equipment, save, settings, controls) |

Red zones on the ground are enemy attacks about to land — step out of them. Enemies roam each area; walk up to them to fight.
Progress auto‑saves on every area change, and you can save to 3 slots from the menu. Difficulty / graphics / volume are under **Settings**.

**Phones:** open the file in landscape. Stick on the left, big ⚔ attack button bottom‑right with the skill buttons (1‑5), dodge ⤼ and
Burst ★ around it, ✦ appears when you stand next to someone to talk, ⇄ switches hero, ☰ opens the menu, drag the right side to turn the camera.
Phones start on the *Low* graphics preset (no post‑processing, no outlines, fewer enemies); change it under Settings → Graphics.

## Where the art comes from (nothing visual is drawn by code)

Every visible thing is a real file from open sources (see [`CREDITS.md`](CREDITS.md) for licences):

* **Characters** – real 3D anime models: the *VRoid Studio CC0 models* (VRoid Project / pixiv, CC0) loaded with
  `@pixiv/three-vrm` and cel‑shaded (MToon, outlines). Every humanoid in the game — heroes, townsfolk, goblins, pirates,
  villains — is one of these avatars, re‑tinted / rescaled / given props. Monsters (orc brute, frog, demon, ghost…) are
  rigged CC0 Quaternius GLBs. Dialogue portraits and face icons are rendered live from the same 3D models.
* **World** – CC0 low‑poly props (trees, rocks, crystals, tents, columns…) re‑lit with toon shading and smoothed normals,
  and PS1‑style surface textures that are softened into painterly surfaces (Quaternius, Kenney, Screaming Brain Studios).
  Houses, walls, piers, torii and dungeons are geometry covered with those real texture images.
* **Audio** – CC0 Kenney sound effects and CC0 music from OpenGameArt (cynicmusic, Bonsaiheldin, messersm, Juhani Junkala,
  Alexander Ehlers…). The forest, shrine and port themes are generated live by a small Web Audio score engine.
* **Fonts** – Zen Maru Gothic and Cinzel (OFL).

## Build & develop

```bash
cd hoshikage-chronicle
npm install                 # three.js + esbuild
bash tools/fetch-vrm.sh && bash tools/fetch-music.sh && python3 tools/optimize-vrm.py   # (optional) fetch VRoid models + music from OpenGameArt
npm run assets              # (optional) re-download npm packages and rebuild assets/  (needs python3 + Pillow + ffmpeg)
npm run build               # -> dist/hoshikage-chronicle.html  (single file)  +  dist/dev.html (loads ./assets)
node tools/build.mjs --dev-only --no-min      # fast dev bundle
python3 -m http.server 8000 # then open http://localhost:8000/dist/dev.html
```

### Tools
* `tools/sim.mjs` – the old turn‑based balance simulator (kept for the stat / damage tables; the real‑time fights use the same numbers).
* `tools/check-maps.mjs` – verifies every NPC, chest, exit and trigger in the generated dungeons is reachable.
* `tools/story-test.mjs` – headless‑Chromium smoke test that jumps to every scripted scene (all recruits, all bosses, the ending) and lets a bot play it.
* `tools/play.mjs` / `tools/shot.mjs` – scripted playtest + screenshot helpers.

## Project layout

```
src/core      renderer + post FX, asset loader, input, audio, generative music
src/world     map builder (instanced props, textured geometry, collision), field mode, 3D actors (VRM / GLB)
src/combat    real‑time combat: engine (combat.js), moves & skill kits, HUD, visual effects
src/battle    pure damage / stat rules (core.js) and the elemental effects (fx.js)
src/ui        dialogue (visual‑novel style), menus, title screen
src/data      characters, skills, items, enemies, maps & story scripts per chapter
assets/       processed art/audio (generated by tools/prepare-assets.py from npm packages)
dist/         build output
```
