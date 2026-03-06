#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

HUB_ROOT="${HUB_ROOT_OVERRIDE:-$DEFAULT_HUB_ROOT}"
WORKSPACE_ROOT="${WORKSPACE_ROOT_OVERRIDE:-$(cd "$HUB_ROOT/.." && pwd)}"

IOS_REPO="${IOS_REPO_OVERRIDE:-$WORKSPACE_ROOT/stack-my-architecture-ios}"
ANDROID_REPO="${ANDROID_REPO_OVERRIDE:-$WORKSPACE_ROOT/stack-my-architecture-android}"
SDD_REPO="${SDD_REPO_OVERRIDE:-$WORKSPACE_ROOT/stack-my-architecture-SDD}"

resolve_course_root() {
  local candidate="$1"
  local nested_name="$2"

  if [ -f "$candidate/scripts/build-html.py" ]; then
    printf '%s\n' "$candidate"
    return
  fi

  if [ -f "$candidate/$nested_name/scripts/build-html.py" ]; then
    printf '%s\n' "$candidate/$nested_name"
    return
  fi

  printf '%s\n' "$candidate"
}

IOS_REPO="$(resolve_course_root "$IOS_REPO" "stack-my-architecture-ios")"
ANDROID_REPO="$(resolve_course_root "$ANDROID_REPO" "stack-my-architecture-android")"
SDD_REPO="$(resolve_course_root "$SDD_REPO" "stack-my-architecture-SDD")"

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  cat <<EOF
Uso:
  ./scripts/check-selective-sync-drift.sh

Descripción:
  Compara bundles publicados del Hub contra los dist de iOS/Android/SDD.
  Sale con 0 si no hay drift y 1 si hay diferencias o archivos ausentes.

Overrides opcionales por entorno:
  HUB_ROOT_OVERRIDE
  WORKSPACE_ROOT_OVERRIDE
  IOS_REPO_OVERRIDE
  ANDROID_REPO_OVERRIDE
  SDD_REPO_OVERRIDE
EOF
  exit 0
fi

status=0
checks_total=0
checks_ok=0

check_pair() {
  local hub_rel="$1"
  local src_abs="$2"
  local label="$3"
  local hub_abs="$HUB_ROOT/$hub_rel"

  checks_total=$((checks_total + 1))

  if [ ! -f "$hub_abs" ]; then
    echo "MISS_HUB $label -> $hub_abs"
    status=1
    return
  fi

  if [ ! -f "$src_abs" ]; then
    echo "MISS_SRC $label -> $src_abs"
    status=1
    return
  fi

  if cmp -s "$hub_abs" "$src_abs"; then
    echo "OK   $label"
    checks_ok=$((checks_ok + 1))
  else
    echo "DIFF $label"
    status=1
  fi
}

check_pair "ios/curso-stack-my-architecture.html" "$IOS_REPO/dist/curso-stack-my-architecture.html" "ios/curso"
check_pair "ios/index.html" "$IOS_REPO/dist/curso-stack-my-architecture.html" "ios/index<=curso"
check_pair "android/curso-stack-my-architecture-android.html" "$ANDROID_REPO/dist/curso-stack-my-architecture-android.html" "android/curso"
check_pair "android/index.html" "$ANDROID_REPO/dist/index.html" "android/index"
check_pair "sdd/curso-stack-my-architecture-sdd.html" "$SDD_REPO/dist/curso-stack-my-architecture-sdd.html" "sdd/curso"
check_pair "sdd/index.html" "$SDD_REPO/dist/index.html" "sdd/index"

if [ "$status" -eq 0 ]; then
  echo "[SUMMARY] no drift ($checks_ok/$checks_total)"
else
  echo "[SUMMARY] drift detected ($checks_ok/$checks_total)"
fi

exit "$status"
