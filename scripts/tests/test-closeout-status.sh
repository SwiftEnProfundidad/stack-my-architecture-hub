#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
STATUS_SCRIPT="$HUB_ROOT/scripts/closeout-status.sh"

TMP_DIR="$(mktemp -d)"
COOLDOWN_FILE="$TMP_DIR/vercel-deploy-cooldown.env"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

assert_eq() {
  local expected="$1"
  local actual="$2"
  local msg="$3"
  if [[ "$expected" != "$actual" ]]; then
    echo "[FAIL] $msg (expected=$expected actual=$actual)"
    exit 1
  fi
}

assert_contains() {
  local file="$1"
  local pattern="$2"
  local msg="$3"
  if ! rg -q -- "$pattern" "$file"; then
    echo "[FAIL] $msg (pattern='$pattern')"
    echo "--- $file ---"
    cat "$file"
    exit 1
  fi
}

run_status() {
  local output_file="$1"
  set +e
  SMA_CLOSEOUT_COOLDOWN_FILE="$COOLDOWN_FILE" "$STATUS_SCRIPT" >"$output_file" 2>&1
  local code=$?
  set -e
  echo "$code"
}

# Case 1: no cooldown file
rm -f "$COOLDOWN_FILE"
code="$(run_status "$TMP_DIR/out1.txt")"
assert_eq "0" "$code" "without cooldown file should return 0"
assert_contains "$TMP_DIR/out1.txt" "Cooldown: no registrado" "should report no cooldown"

# Case 2: active cooldown
future_epoch="$(( $(date +%s) + 3600 ))"
future_local="$(date -r "$future_epoch" '+%Y-%m-%d %H:%M:%S %Z')"
cat >"$COOLDOWN_FILE" <<EOF
not_before_epoch=$future_epoch
not_before_local='$future_local'
reason='api-deployments-free-per-day'
last_error_seen_at='now'
EOF
code="$(run_status "$TMP_DIR/out2.txt")"
assert_eq "2" "$code" "active cooldown should return 2"
assert_contains "$TMP_DIR/out2.txt" "Cooldown: activo" "should report active cooldown"
assert_contains "$TMP_DIR/out2.txt" "Motivo: api-deployments-free-per-day" "should report reason"

# Case 3: expired cooldown
past_epoch="$(( $(date +%s) - 60 ))"
past_local="$(date -r "$past_epoch" '+%Y-%m-%d %H:%M:%S %Z')"
cat >"$COOLDOWN_FILE" <<EOF
not_before_epoch=$past_epoch
not_before_local='$past_local'
reason='api-deployments-free-per-day'
last_error_seen_at='old'
EOF
code="$(run_status "$TMP_DIR/out3.txt")"
assert_eq "0" "$code" "expired cooldown should return 0"
assert_contains "$TMP_DIR/out3.txt" "Cooldown: expirado" "should report expired cooldown"
assert_contains "$TMP_DIR/out3.txt" "Estado: listo para reintento de deploy" "should report ready state"

echo "[PASS] closeout-status tests"
