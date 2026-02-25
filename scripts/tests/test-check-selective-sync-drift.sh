#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECKER_SCRIPT="$SCRIPT_DIR/../check-selective-sync-drift.sh"

TMP_ROOT="$(mktemp -d /tmp/hub-sync-drift-test-XXXX)"
trap 'rm -rf "$TMP_ROOT"' EXIT

HUB="$TMP_ROOT/stack-my-architecture-hub"
IOS="$TMP_ROOT/stack-my-architecture-ios"
ANDROID="$TMP_ROOT/stack-my-architecture-android"
SDD="$TMP_ROOT/stack-my-architecture-SDD"

mkdir -p "$HUB/ios" "$HUB/android" "$HUB/sdd"
mkdir -p "$IOS/dist" "$ANDROID/dist" "$SDD/dist"

write_fixtures() {
  printf 'ios-course-v1\n' > "$IOS/dist/curso-stack-my-architecture.html"
  printf 'android-index-v1\n' > "$ANDROID/dist/index.html"
  printf 'android-course-v1\n' > "$ANDROID/dist/curso-stack-my-architecture-android.html"
  printf 'sdd-index-v1\n' > "$SDD/dist/index.html"
  printf 'sdd-course-v1\n' > "$SDD/dist/curso-stack-my-architecture-sdd.html"

  cp "$IOS/dist/curso-stack-my-architecture.html" "$HUB/ios/curso-stack-my-architecture.html"
  cp "$IOS/dist/curso-stack-my-architecture.html" "$HUB/ios/index.html"
  cp "$ANDROID/dist/index.html" "$HUB/android/index.html"
  cp "$ANDROID/dist/curso-stack-my-architecture-android.html" "$HUB/android/curso-stack-my-architecture-android.html"
  cp "$SDD/dist/index.html" "$HUB/sdd/index.html"
  cp "$SDD/dist/curso-stack-my-architecture-sdd.html" "$HUB/sdd/curso-stack-my-architecture-sdd.html"
}

run_checker() {
  local output_file="$1"
  shift
  HUB_ROOT_OVERRIDE="$HUB" \
  WORKSPACE_ROOT_OVERRIDE="$TMP_ROOT" \
  "$CHECKER_SCRIPT" "$@" >"$output_file" 2>&1
}

assert_exit_ok() {
  local desc="$1"
  local output_file="$2"
  if run_checker "$output_file"; then
    echo "[PASS] $desc"
  else
    echo "[FAIL] $desc"
    cat "$output_file"
    exit 1
  fi
}

assert_exit_fail() {
  local desc="$1"
  local output_file="$2"
  if run_checker "$output_file"; then
    echo "[FAIL] $desc"
    cat "$output_file"
    exit 1
  else
    echo "[PASS] $desc"
  fi
}

write_fixtures

OUT_OK="$TMP_ROOT/out-ok.log"
OUT_DIFF="$TMP_ROOT/out-diff.log"
OUT_MISS="$TMP_ROOT/out-miss.log"

assert_exit_ok "match -> exit 0" "$OUT_OK"

printf 'android-index-v2\n' > "$ANDROID/dist/index.html"
assert_exit_fail "drift -> exit 1" "$OUT_DIFF"
grep -q "DIFF" "$OUT_DIFF"

write_fixtures
rm -f "$SDD/dist/index.html"
assert_exit_fail "missing source -> exit 1" "$OUT_MISS"
grep -q "MISS_SRC" "$OUT_MISS"

echo "All tests passed."
