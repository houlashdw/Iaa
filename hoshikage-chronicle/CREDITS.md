# Credits & licences

This game's code is original. All art and audio files come from the following open packages, obtained from the npm registry
(`npm pack <name>`; see `tools/fetch-assets.sh`). Licence texts are in [`assets/LICENSES/`](assets/LICENSES).

## Character art — Sprite Foundry (MIT)
Painted, relightable 512 px 8‑direction sprite sets (only the albedo layer is used). Face thumbnails are cropped from the same art.

* `@sprite-foundry/fantasy-heroes-hd` — Haru's allies: White Mage (*Airi*), Samurai (*Ren*), Monk (*Daigo*), Ranger (*Sylva*), Sorcerer (*Zeno*), plus Knight, Mage, Bard…
* `@sprite-foundry/townsfolk-hd` — Haru (the child), Elder, innkeeper, smith, merchant, villagers…
* `@sprite-foundry/goblin-warband-hd` — goblins, Warchief Gruk, the cook…
* `@sprite-foundry/pirate-raiders-hd` — pirates, Captain Redtide, First Mate Orlo, the Sea‑witch…
* `@sprite-foundry/fantasy-villains-hd` — Bandit King, Necromancer, Gorgon, Matriarch, Warlord, Lord Kurohane, the Hollow Sovereign…

## 3D props, textures, sound effects — `@netforge/asset-library-files` (MIT wrapper, CC0 content)
* **Quaternius** (CC0) and **Kenney** (CC0) — low‑poly models: trees, rocks, crystals, tents, columns, barrels, chest, campfire, ship…
* **Screaming Brain Studios** (CC0, via OpenGameArt) — *Tiny / Synthetic / Base Material* texture packs (grass, stone, dirt, wood, wall, plate…).
* **Kenney** (CC0) — Impact, Interface, RPG, Sci‑fi and Digital sound packs (battle and UI effects).

## Music
* **"Battle Theme A"** — *The Cynic Project* / cynicmusic (CC0), <https://opengameart.org/content/battle-theme-a>.
* Title, town, forest, shrine, port, cave and castle themes are **generated at runtime** by `src/core/music.js` (Web Audio oscillators), because no other CC0 music files were reachable from the build environment.

## Fonts (SIL Open Font Licence 1.1, via Fontsource)
* Zen Maru Gothic, Cinzel.

## Engine
* [three.js](https://threejs.org) (MIT) · esbuild (MIT).
