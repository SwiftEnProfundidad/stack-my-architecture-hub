#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECTS_ROOT="$(cd "$HUB_ROOT/.." && pwd)"
IOS_ROOT="$PROJECTS_ROOT/stack-my-architecture-ios"
ANDROID_ROOT="$PROJECTS_ROOT/stack-my-architecture-android"
SDD_ROOT="$PROJECTS_ROOT/stack-my-architecture-SDD"

IOS_OUTPUT="$IOS_ROOT/dist"
ANDROID_OUTPUT="$ANDROID_ROOT/dist"
SDD_OUTPUT="$SDD_ROOT/dist"

if [[ ! -d "$IOS_ROOT" || ! -d "$ANDROID_ROOT" || ! -d "$SDD_ROOT" ]]; then
  echo "[ERROR] Could not find sibling repos: stack-my-architecture-ios, stack-my-architecture-android, stack-my-architecture-SDD"
  exit 1
fi

echo "[1/6] Building iOS HTML output..."
python3 "$IOS_ROOT/scripts/build-html.py"

echo "[2/6] Building Android HTML output..."
python3 "$ANDROID_ROOT/scripts/build-html.py"

echo "[3/6] Building SDD HTML output..."
python3 "$SDD_ROOT/scripts/build-html.py"

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

echo "[4/6] Copying iOS output folder AS-IS to hub/ios ..."
copy_dir "$IOS_OUTPUT" "$HUB_ROOT/ios"

echo "[5/6] Copying Android output folder AS-IS to hub/android ..."
copy_dir "$ANDROID_OUTPUT" "$HUB_ROOT/android"

echo "[6/6] Copying SDD output folder AS-IS to hub/sdd ..."
copy_dir "$SDD_OUTPUT" "$HUB_ROOT/sdd"

if [[ -f "$HUB_ROOT/ios/curso-stack-my-architecture.html" ]]; then
  cp "$HUB_ROOT/ios/curso-stack-my-architecture.html" "$HUB_ROOT/ios/index.html"
fi

if [[ -f "$HUB_ROOT/android/curso-stack-my-architecture-android.html" ]]; then
  cp "$HUB_ROOT/android/curso-stack-my-architecture-android.html" "$HUB_ROOT/android/index.html"
fi

if [[ -f "$HUB_ROOT/sdd/curso-stack-my-architecture-sdd.html" ]]; then
  cp "$HUB_ROOT/sdd/curso-stack-my-architecture-sdd.html" "$HUB_ROOT/sdd/index.html"
fi

echo "Hub ready: $HUB_ROOT/index.html"
