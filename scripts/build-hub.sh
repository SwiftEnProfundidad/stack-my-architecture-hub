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
GOVERNANCE_ROOT="$PROJECTS_ROOT/stack-my-architecture-governance"
PUMUKI_ROOT="$PROJECTS_ROOT/stack-my-architecture-pumuki"
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
  strict (default)  Build iOS + Android + run full SDD audit gate before publishing; then Governance + Pumuki if sibling repos exist.
  fast              Build iOS + Android + SDD HTML without full SDD audit gate; then Governance + Pumuki if sibling repos exist.

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
say "[1/11] Building iOS HTML output..."
python3 "$IOS_ROOT/scripts/build-html.py"

say "[2/11] Building Android HTML output..."
python3 "$ANDROID_ROOT/scripts/build-html.py"

if [[ "$MODE" == "fast" ]]; then
  say "[3/11] Fast mode: skipping strict SDD gate and building SDD HTML only..."
  python3 "$SDD_ROOT/scripts/build-html.py"
else
  if [[ ! -x "$SDD_AUDIT_SCRIPT" ]]; then
    echo "[ERROR] Missing or non-executable SDD audit script: $SDD_AUDIT_SCRIPT"
    exit 1
  fi
  say "[3/11] Running strict SDD full audit gate..."
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

ensure_hub_gitignore() {
  local dst="$1"
  printf '.vercel\n' > "$dst/.gitignore"
}

say "[4/11] Copying iOS output folder AS-IS to hub/ios ..."
copy_dir "$IOS_OUTPUT" "$HUB_ROOT/ios"
ensure_hub_gitignore "$HUB_ROOT/ios"

say "[5/11] Copying Android output folder AS-IS to hub/android ..."
copy_dir "$ANDROID_OUTPUT" "$HUB_ROOT/android"
ensure_hub_gitignore "$HUB_ROOT/android"

say "[6/11] Copying SDD output folder AS-IS to hub/sdd ..."
copy_dir "$SDD_OUTPUT" "$HUB_ROOT/sdd"
ensure_hub_gitignore "$HUB_ROOT/sdd"

if [[ -f "$HUB_ROOT/ios/curso-stack-my-architecture.html" ]]; then
  cp "$HUB_ROOT/ios/curso-stack-my-architecture.html" "$HUB_ROOT/ios/index.html"
fi

if [[ -f "$HUB_ROOT/android/curso-stack-my-architecture-android.html" ]]; then
  cp "$HUB_ROOT/android/curso-stack-my-architecture-android.html" "$HUB_ROOT/android/index.html"
fi

if [[ -f "$HUB_ROOT/sdd/curso-stack-my-architecture-sdd.html" ]]; then
  cp "$HUB_ROOT/sdd/curso-stack-my-architecture-sdd.html" "$HUB_ROOT/sdd/index.html"
fi

say "[7/11] Governance course: build + copy HTML only (preserves hub/governance/assets)..."
if [[ -d "$GOVERNANCE_ROOT" && -f "$GOVERNANCE_ROOT/scripts/build-html.py" ]]; then
  python3 "$GOVERNANCE_ROOT/scripts/build-html.py"
  gov_html="$GOVERNANCE_ROOT/dist/curso-stack-my-architecture-governance.html"
  if [[ ! -f "$gov_html" ]]; then
    echo "[ERROR] Governance HTML missing after build: $gov_html"
    exit 1
  fi
  mkdir -p "$HUB_ROOT/governance"
  cp "$gov_html" "$HUB_ROOT/governance/"
  if [[ -f "$GOVERNANCE_ROOT/dist/index.html" ]]; then
    cp "$GOVERNANCE_ROOT/dist/index.html" "$HUB_ROOT/governance/index.html"
  else
    cp "$gov_html" "$HUB_ROOT/governance/index.html"
  fi
  ensure_hub_gitignore "$HUB_ROOT/governance"
  say "  Governance HTML -> $HUB_ROOT/governance/"
else
  say "  [SKIP] Governance repo not found at $GOVERNANCE_ROOT"
fi

say "[8/11] Pumuki course: build (syncs to hub/pumuki when sibling hub exists)..."
if [[ -d "$PUMUKI_ROOT" && -f "$PUMUKI_ROOT/scripts/build-html.py" ]]; then
  python3 "$PUMUKI_ROOT/scripts/build-html.py"
else
  say "  [SKIP] Pumuki repo not found at $PUMUKI_ROOT"
fi

if [[ ! -x "$VERIFY_SCRIPT" ]]; then
  echo "[ERROR] Missing or non-executable hub verification script: $VERIFY_SCRIPT"
  exit 1
fi

say "[9/11] Verifying hub output integrity..."
python3 "$VERIFY_SCRIPT"

if [[ "$MODE" == "fast" || "${SKIP_RUNTIME_SMOKE:-0}" == "1" ]]; then
  say "[10/11] Runtime smoke skipped (mode=$MODE, SKIP_RUNTIME_SMOKE=${SKIP_RUNTIME_SMOKE:-0})"
else
  if [[ ! -x "$RUNTIME_SMOKE_SCRIPT" ]]; then
    echo "[ERROR] Missing or non-executable runtime smoke script: $RUNTIME_SMOKE_SCRIPT"
    exit 1
  fi
  say "[10/11] Running runtime smoke test on temporary server..."
  "$RUNTIME_SMOKE_SCRIPT"
  RUNTIME_SMOKE_RAN=1
fi

if [[ ! -x "$MANIFEST_SCRIPT" ]]; then
  echo "[ERROR] Missing or non-executable manifest script: $MANIFEST_SCRIPT"
  exit 1
fi

say "[11/11] Generating build manifest..."
python3 "$MANIFEST_SCRIPT" \
  --mode "$MODE" \
  --sdd-audit-ran "$SDD_AUDIT_RAN" \
  --runtime-smoke-ran "$RUNTIME_SMOKE_RAN"

say "Hub ready: $HUB_ROOT/index.html"
say "Build log: $LOG_FILE"
