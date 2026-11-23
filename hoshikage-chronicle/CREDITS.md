# Credits & licences

This game's code, story and systems are original. Every model, texture and sound is a real file from the open sources below
(licence texts in [`assets/LICENSES/`](assets/LICENSES)). Nothing visual is drawn by code.

## Characters — VRoid Studio CC0 models (CC0 1.0)
Anime avatars released into the public domain by the **VRoid Project / pixiv**, via OpenGameArt:
<https://opengameart.org/content/vroid-studio-cc0-models> — base_male, base_female, AvatarSample D / D‑Darkness / E / F / G,
Sakurada Fumiriya, Sendagaya Shino. They are cel‑shaded (MToon) 3D models; the game re‑tints, rescales and props them per
character (Haru's straw hat, Ren's katana, Airi's staff…) and animates them with its own procedural pose code.
Optimised by `tools/optimize-vrm.py` (WebP textures, blend shapes removed). Loader: [`@pixiv/three-vrm`](https://github.com/pixiv/three-vrm) (MIT).

## Creatures, props, textures, sound effects — `@netforge/asset-library-files` (MIT wrapper, CC0 content)
* **Quaternius** (CC0) — rigged creatures (orc brute, frog, demon, ghost, skeleton, wolf) and low‑poly props: trees, rocks, crystals, tents, columns, barrels, chest, campfire, ship…
* **Screaming Brain Studios** (CC0, via OpenGameArt) — *Tiny / Synthetic / Base Material* texture packs (grass, stone, dirt, wood, wall, plate…). They are pixel‑art sources; the build softens them into painterly surfaces (`tools/prepare-assets.py`).
* **Kenney** (CC0) — Impact, Interface, RPG, Sci‑fi and Digital sound packs (battle and UI effects).

## Music (all CC0, OpenGameArt)
* *The Field Of Dreams* (anonymous) — title · *Town Theme RPG* by Bonsaiheldin — villages · *Crystal Cave (song18)* by messersm — caverns
* *Doomed* and *Waking the devil* by Alexander Ehlers (Free Music Pack) — castle and final boss
* *Epic Boss Battle* by Juhani Junkala — boss fights · *Battle Theme A* by The Cynic Project / cynicmusic — battles
* The forest, shrine, port and quiet cut‑scene themes are generated at runtime by `src/core/music.js` (Web Audio).

## Fonts (SIL Open Font Licence 1.1, via Fontsource)
* Zen Maru Gothic, Cinzel.

## Engine
* [three.js](https://threejs.org) (MIT) · esbuild (MIT).
