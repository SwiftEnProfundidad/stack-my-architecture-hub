#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECTS_ROOT="$(cd "$HUB_ROOT/.." && pwd)"
RUNTIME_DIR="$HUB_ROOT/.runtime"
LOCK_DIR="$RUNTIME_DIR/build-hub.lock"
LOG_FILE="$RUNTIME_DIR/build-hub.log"

IOS_ROOT="$PROJECTS_ROOT/stack-my-architecture-ios"
ANDROID_ROOT="$PROJECTS_ROOT/stack-my-architecture-android"
SDD_ROOT="$PROJECTS_ROOT/stack-my-architecture-SDD"
SDD_AUDIT_SCRIPT="$SDD_ROOT/scripts/run-full-audit.sh"
VERIFY_SCRIPT="$SCRIPT_DIR/verify-hub-build.py"
RUNTIME_SMOKE_SCRIPT="$SCRIPT_DIR/smoke-hub-runtime.sh"

IOS_OUTPUT="$IOS_ROOT/dist"
ANDROID_OUTPUT="$ANDROID_ROOT/dist"
SDD_OUTPUT="$SDD_ROOT/dist"

MODE="strict"

usage() {
  cat <<'EOF'
Usage: ./scripts/build-hub.sh [--mode strict|fast] [--strict] [--fast]

Modes:
  strict (default)  Build iOS + Android + run full SDD audit gate before publishing.
  fast              Build iOS + Android + SDD HTML without full SDD audit gate.

Legacy compatibility:
  SKIP_SDD_AUDIT=1 forces fast mode.
EOF
}

say() {
  printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      if [[ $# -lt 2 ]]; then
        echo "[ERROR] Missing value for --mode"
        exit 1
      fi
      MODE="$2"
      shift 2
      ;;
    --strict)
      MODE="strict"
      shift
      ;;
    --fast)
      MODE="fast"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[ERROR] Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ "$MODE" != "strict" && "$MODE" != "fast" ]]; then
  echo "[ERROR] Unsupported mode: $MODE (allowed: strict, fast)"
  exit 1
fi

if [[ "${SKIP_SDD_AUDIT:-0}" == "1" && "$MODE" == "strict" ]]; then
  say "WARNING: SKIP_SDD_AUDIT=1 detected, forcing mode=fast for backward compatibility."
  MODE="fast"
fi

mkdir -p "$RUNTIME_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "[ERROR] Another build-hub execution is in progress. Lock: $LOCK_DIR"
  exit 1
fi
trap 'rm -rf "$LOCK_DIR"' EXIT

if [[ ! -d "$IOS_ROOT" || ! -d "$ANDROID_ROOT" || ! -d "$SDD_ROOT" ]]; then
  echo "[ERROR] Could not find sibling repos: stack-my-architecture-ios, stack-my-architecture-android, stack-my-architecture-SDD"
  exit 1
fi

say "Starting hub build (mode=$MODE)"
say "[1/8] Building iOS HTML output..."
python3 "$IOS_ROOT/scripts/build-html.py"

say "[2/8] Building Android HTML output..."
python3 "$ANDROID_ROOT/scripts/build-html.py"

if [[ "$MODE" == "fast" ]]; then
  say "[3/8] Fast mode: skipping strict SDD gate and building SDD HTML only..."
  python3 "$SDD_ROOT/scripts/build-html.py"
else
  if [[ ! -x "$SDD_AUDIT_SCRIPT" ]]; then
    echo "[ERROR] Missing or non-executable SDD audit script: $SDD_AUDIT_SCRIPT"
    exit 1
  fi
  say "[3/8] Running strict SDD full audit gate..."
  "$SDD_AUDIT_SCRIPT"
fi

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

say "[4/8] Copying iOS output folder AS-IS to hub/ios ..."
copy_dir "$IOS_OUTPUT" "$HUB_ROOT/ios"

say "[5/8] Copying Android output folder AS-IS to hub/android ..."
copy_dir "$ANDROID_OUTPUT" "$HUB_ROOT/android"

say "[6/8] Copying SDD output folder AS-IS to hub/sdd ..."
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

if [[ ! -x "$VERIFY_SCRIPT" ]]; then
  echo "[ERROR] Missing or non-executable hub verification script: $VERIFY_SCRIPT"
  exit 1
fi

say "[7/8] Verifying hub output integrity..."
python3 "$VERIFY_SCRIPT"

if [[ "$MODE" == "fast" || "${SKIP_RUNTIME_SMOKE:-0}" == "1" ]]; then
  say "[8/8] Runtime smoke skipped (mode=$MODE, SKIP_RUNTIME_SMOKE=${SKIP_RUNTIME_SMOKE:-0})"
else
  if [[ ! -x "$RUNTIME_SMOKE_SCRIPT" ]]; then
    echo "[ERROR] Missing or non-executable runtime smoke script: $RUNTIME_SMOKE_SCRIPT"
    exit 1
  fi
  say "[8/8] Running runtime smoke test on temporary server..."
  "$RUNTIME_SMOKE_SCRIPT"
fi

say "Hub ready: $HUB_ROOT/index.html"
say "Build log: $LOG_FILE"
