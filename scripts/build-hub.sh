#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECTS_ROOT="$(cd "$HUB_ROOT/.." && pwd)"
IOS_ROOT="$PROJECTS_ROOT/stack-my-architecture-ios"
ANDROID_ROOT="$PROJECTS_ROOT/stack-my-architecture-android"

IOS_OUTPUT="$IOS_ROOT/dist"
ANDROID_OUTPUT="$ANDROID_ROOT/dist"

if [[ ! -d "$IOS_ROOT" || ! -d "$ANDROID_ROOT" ]]; then
  echo "[ERROR] Could not find sibling repos: stack-my-architecture-ios and stack-my-architecture-android"
  exit 1
fi

echo "[1/4] Building iOS HTML output..."
python3 "$IOS_ROOT/scripts/build-html.py"

echo "[2/4] Building Android HTML output..."
python3 "$ANDROID_ROOT/scripts/build-html.py"

copy_dir() {
  local src="$1"
  local dst="$2"

  if [[ ! -d "$src" ]]; then
    echo "[ERROR] Missing source output folder: $src"
    exit 1
  fi

  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "$src/" "$dst/"
  else
    rm -rf "$dst"
    mkdir -p "$dst"
    cp -R "$src/." "$dst/"
  fi
}

echo "[3/4] Copying iOS output folder AS-IS to hub/ios ..."
copy_dir "$IOS_OUTPUT" "$HUB_ROOT/ios"

echo "[4/4] Copying Android output folder AS-IS to hub/android ..."
copy_dir "$ANDROID_OUTPUT" "$HUB_ROOT/android"

if [[ -f "$HUB_ROOT/ios/curso-stack-my-architecture.html" ]]; then
  cp "$HUB_ROOT/ios/curso-stack-my-architecture.html" "$HUB_ROOT/ios/index.html"
fi

if [[ -f "$HUB_ROOT/android/curso-stack-my-architecture-android.html" ]]; then
  cp "$HUB_ROOT/android/curso-stack-my-architecture-android.html" "$HUB_ROOT/android/index.html"
fi

echo "Hub ready: $HUB_ROOT/index.html"
