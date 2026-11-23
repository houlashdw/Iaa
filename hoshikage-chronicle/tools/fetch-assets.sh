#!/usr/bin/env bash
# Downloads the third-party art/audio packages from the npm registry into .cache/src/<pkg>.
# Everything the game shows or plays is a real file coming out of these packages (see CREDITS.md).
set -euo pipefail
cd "$(dirname "$0")/.."
CACHE=.cache
mkdir -p "$CACHE/tgz" "$CACHE/src"
PKGS=(
  @sprite-foundry/fantasy-heroes-hd
  @sprite-foundry/fantasy-villains-hd
  @sprite-foundry/goblin-warband-hd
  @sprite-foundry/pirate-raiders-hd
  @sprite-foundry/townsfolk-hd
  @netforge/asset-library-files
  @fontsource/zen-maru-gothic
  @fontsource/cinzel
)
for p in "${PKGS[@]}"; do
  name=$(echo "$p" | sed 's#^@##; s#/#__#')
  if [ -d "$CACHE/src/$name" ]; then echo "have $p"; continue; fi
  echo "fetching $p"
  f=$(npm pack "$p" --silent --pack-destination "$CACHE/tgz" | tail -1)
  mkdir -p "$CACHE/src/$name"
  tar -xzf "$CACHE/tgz/$f" -C "$CACHE/src/$name" --strip-components=1
done
echo "done"
