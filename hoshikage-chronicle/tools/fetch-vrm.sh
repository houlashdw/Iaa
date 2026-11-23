#!/usr/bin/env bash
# Downloads the CC0 "VRoid Studio CC0 models" from OpenGameArt into .cache/vrm
#   https://opengameart.org/content/vroid-studio-cc0-models   (released by VRoid / pixiv under CC0)
set -euo pipefail
cd "$(dirname "$0")/.."
D=.cache/vrm
mkdir -p "$D"
UA="hoshikage-asset-fetch/1.0"
for n in base_female base_male avatarsample_d_0 avatarsample_d_darkness avatarsample_e avatarsample_f avatarsample_g sakurada_fumiriya sendagaya_shino; do
  if ls "$D"/"$n".zip >/dev/null 2>&1; then echo "have $n"; continue; fi
  echo "fetching $n"
  curl -fsSL -A "$UA" -o "$D/$n.zip" "https://opengameart.org/sites/default/files/$n.zip"
  python3 -I -c "import zipfile; zipfile.ZipFile('$D/$n.zip').extractall('$D')"
  sleep 1
done
echo done
