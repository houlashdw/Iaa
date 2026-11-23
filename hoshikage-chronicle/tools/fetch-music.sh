#!/usr/bin/env bash
# Downloads the CC0 music tracks from OpenGameArt into .cache/music (licence of each page verified as CC0).
#   Town Theme RPG ............ Bonsaiheldin        https://opengameart.org/content/town-theme-rpg
#   Crystal Cave (song18) ..... messersm            https://opengameart.org/content/crystal-cave-song18
#   The Field Of Dreams ....... anonymous           https://opengameart.org/content/the-field-of-dreams
#   Epic Boss Battle .......... Juhani Junkala      https://opengameart.org/content/boss-battle-music
#   Free Music Pack ........... Alexander Ehlers    https://opengameart.org/content/free-music-pack
set -euo pipefail
cd "$(dirname "$0")/.."
D=.cache/music
mkdir -p "$D"
UA="hoshikage-asset-fetch/1.0"
BASE="https://opengameart.org/sites/default/files"
get() { # <remote name (url-encoded)> <local name>
  [ -s "$D/$2" ] && { echo "have $2"; return; }
  echo "fetching $2"
  curl -fsSL -A "$UA" -o "$D/$2" "$BASE/$1"
  sleep 1
}
get "TownTheme.mp3" town.mp3
get "song18_0.mp3" cave.mp3
get "the_field_of_dreams.mp3" title.mp3
get "Juhani%20Junkala%20-%20Epic%20Boss%20Battle%20%5BSeamlessly%20Looping%5D.wav" boss_theme.wav
get "Alexander%20Ehlers%20-%20Free%20Music%20Pack.zip" ehlers_pack.zip
if [ ! -s "$D/castle.mp3" ]; then
  python3 -I - <<'PY'
import zipfile
z = zipfile.ZipFile('.cache/music/ehlers_pack.zip')
for src, dst in (('Alexander Ehlers - Free Music Pack/Alexander Ehlers - Doomed.mp3', 'castle.mp3'),
                 ('Alexander Ehlers - Free Music Pack/Alexander Ehlers - Waking the devil.mp3', 'final_boss.mp3')):
    open('.cache/music/' + dst, 'wb').write(z.read(src))
PY
fi
echo done
