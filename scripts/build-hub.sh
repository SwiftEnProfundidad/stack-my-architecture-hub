#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECTS_ROOT="$(cd "$HUB_ROOT/.." && pwd)"
RUNTIME_DIR="$HUB_ROOT/.runtime"
LOCK_DIR="$RUNTIME_DIR/build-hub.lock"
LOCK_PID_FILE="$LOCK_DIR/pid"
LOCK_STARTED_FILE="$LOCK_DIR/started_at_utc"
LOG_FILE="$RUNTIME_DIR/build-hub.log"

IOS_ROOT="$PROJECTS_ROOT/stack-my-architecture-ios"
ANDROID_ROOT="$PROJECTS_ROOT/stack-my-architecture-android"
SDD_ROOT="$PROJECTS_ROOT/stack-my-architecture-SDD"
SDD_AUDIT_SCRIPT="$SDD_ROOT/scripts/run-full-audit.sh"
VERIFY_SCRIPT="$SCRIPT_DIR/verify-hub-build.py"
RUNTIME_SMOKE_SCRIPT="$SCRIPT_DIR/smoke-hub-runtime.sh"
MANIFEST_SCRIPT="$SCRIPT_DIR/generate-build-manifest.py"

IOS_OUTPUT="$IOS_ROOT/dist"
ANDROID_OUTPUT="$ANDROID_ROOT/dist"
SDD_OUTPUT="$SDD_ROOT/dist"

MODE="strict"
SDD_AUDIT_RAN=0
RUNTIME_SMOKE_RAN=0

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

acquire_lock() {
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    printf '%s\n' "$$" > "$LOCK_PID_FILE"
    date -u '+%Y-%m-%dT%H:%M:%SZ' > "$LOCK_STARTED_FILE"
    return 0
  fi

  local owner_pid=""
  if [[ -f "$LOCK_PID_FILE" ]]; then
    owner_pid="$(cat "$LOCK_PID_FILE" 2>/dev/null || true)"
  fi

  if [[ -n "$owner_pid" && "$owner_pid" =~ ^[0-9]+$ ]] && kill -0 "$owner_pid" >/dev/null 2>&1; then
    local owner_cmd
    owner_cmd="$(ps -p "$owner_pid" -o command= 2>/dev/null || true)"
    echo "[ERROR] Another build-hub execution is in progress. Lock: $LOCK_DIR (pid=$owner_pid)"
    if [[ -n "$owner_cmd" ]]; then
      echo "[ERROR] Owner command: $owner_cmd"
    fi
    return 1
  fi

  say "WARNING: Stale lock detected. Recovering lock at $LOCK_DIR"
  rm -rf "$LOCK_DIR"
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    echo "[ERROR] Could not recover lock at $LOCK_DIR"
    return 1
  fi
  printf '%s\n' "$$" > "$LOCK_PID_FILE"
  date -u '+%Y-%m-%dT%H:%M:%SZ' > "$LOCK_STARTED_FILE"
}

release_lock() {
  rm -rf "$LOCK_DIR"
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

if ! acquire_lock; then
  exit 1
fi
trap release_lock EXIT

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
  SDD_AUDIT_RAN=1
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

copy_course_output_preserving_assistant_panel() {
  local src="$1"
  local dst="$2"
  local label="$3"
  local rel_dst="${dst#"$HUB_ROOT"/}"
  local assistant_rel="assets/assistant-panel.js"
  local dst_assistant="$dst/$assistant_rel"
  local backup_file="$RUNTIME_DIR/.preserve-${label}-assistant-panel.js"
  local had_backup=0

  if [[ -f "$dst_assistant" ]]; then
    cp "$dst_assistant" "$backup_file"
    had_backup=1
  fi

  copy_dir "$src" "$dst"

  if [[ "$had_backup" -eq 1 ]]; then
    mkdir -p "$dst/assets"
    cp "$backup_file" "$dst_assistant"
    rm -f "$backup_file"
  fi

  if git -C "$HUB_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git -C "$HUB_ROOT" clean -f -- "$rel_dst/assets" >/dev/null 2>&1 || true
  fi
}

say "[4/8] Copying iOS output folder AS-IS to hub/ios ..."
copy_course_output_preserving_assistant_panel "$IOS_OUTPUT" "$HUB_ROOT/ios" "ios"

say "[5/8] Copying Android output folder AS-IS to hub/android ..."
copy_course_output_preserving_assistant_panel "$ANDROID_OUTPUT" "$HUB_ROOT/android" "android"

say "[6/8] Copying SDD output folder AS-IS to hub/sdd ..."
copy_course_output_preserving_assistant_panel "$SDD_OUTPUT" "$HUB_ROOT/sdd" "sdd"

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
  RUNTIME_SMOKE_RAN=1
fi

if [[ ! -x "$MANIFEST_SCRIPT" ]]; then
  echo "[ERROR] Missing or non-executable manifest script: $MANIFEST_SCRIPT"
  exit 1
fi

say "[audit] Generating build manifest..."
python3 "$MANIFEST_SCRIPT" \
  --mode "$MODE" \
  --sdd-audit-ran "$SDD_AUDIT_RAN" \
  --runtime-smoke-ran "$RUNTIME_SMOKE_RAN"

say "Hub ready: $HUB_ROOT/index.html"
say "Build log: $LOG_FILE"
