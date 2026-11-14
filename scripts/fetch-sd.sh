#!/usr/bin/env bash
# Скачивает stable-diffusion.cpp (зафиксированная версия) для нативного модуля рисования.
set -euo pipefail
SD_COMMIT="6201bcc7ea6d742f0041b1ca169146df5bbc7efc"
DEST="modules/sd-native/third_party/stable-diffusion.cpp"
if [ -f "$DEST/CMakeLists.txt" ] && [ -f "$DEST/ggml/CMakeLists.txt" ]; then
  echo "stable-diffusion.cpp already present"; exit 0
fi
rm -rf "$DEST"
mkdir -p "$DEST"
cd "$DEST"
git init -q
git remote add origin https://github.com/leejet/stable-diffusion.cpp
git fetch -q --depth 1 origin "$SD_COMMIT"
git checkout -q FETCH_HEAD
git submodule update --init --recursive --depth 1
echo "stable-diffusion.cpp ready at $DEST"
