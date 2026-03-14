#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WAIT_SCRIPT="$HUB_ROOT/scripts/closeout-wait-and-run.sh"

TMP_DIR="$(mktemp -d)"
COOLDOWN_FILE="$TMP_DIR/cooldown.env"
DEPLOY_CALLS="$TMP_DIR/deploy-calls.log"
FAKE_DEPLOY="$TMP_DIR/fake-deploy.sh"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

cat >"$FAKE_DEPLOY" <<'EOF'
#!/usr/bin/env bash
echo "$*" >> "${DEPLOY_CALLS:?}"
exit "${FAKE_DEPLOY_EXIT:-0}"
EOF
chmod +x "$FAKE_DEPLOY"

assert_eq() {
  local expected="$1"
  local actual="$2"
  local msg="$3"
  if [[ "$expected" != "$actual" ]]; then
    echo "[FAIL] $msg (expected=$expected actual=$actual)"
    exit 1
  fi
}

assert_file_exists() {
  local path="$1"
  local msg="$2"
  if [[ ! -f "$path" ]]; then
    echo "[FAIL] $msg ($path)"
    exit 1
  fi
}

assert_file_not_exists() {
  local path="$1"
  local msg="$2"
  if [[ -f "$path" ]]; then
    echo "[FAIL] $msg ($path)"
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

run_wait() {
  local output_file="$1"
  shift
  set +e
  DEPLOY_CALLS="$DEPLOY_CALLS" \
  SMA_CLOSEOUT_COOLDOWN_FILE="$COOLDOWN_FILE" \
  SMA_CLOSEOUT_DEPLOY_RUNNER_CMD="$FAKE_DEPLOY" \
  "$WAIT_SCRIPT" "$@" >"$output_file" 2>&1
  local code=$?
  set -e
  echo "$code"
}

rm -f "$COOLDOWN_FILE" "$DEPLOY_CALLS"

# Case 1: no cooldown -> deploy called immediately (exit 0)
code="$(run_wait "$TMP_DIR/out1.txt" fast)"
assert_eq "0" "$code" "no cooldown should run deploy"
assert_file_exists "$DEPLOY_CALLS" "deploy should be called"
assert_contains "$DEPLOY_CALLS" "^fast https://architecture-stack\\.vercel\\.app$" "deploy args should include mode and base url"

# Case 2: cooldown too far + max wait small -> exit 2 and no deploy call
rm -f "$DEPLOY_CALLS"
future_epoch="$(( $(date +%s) + 7200 ))"
future_local="$(date -r "$future_epoch" '+%Y-%m-%d %H:%M:%S %Z')"
cat >"$COOLDOWN_FILE" <<EOF
not_before_epoch=$future_epoch
not_before_local='$future_local'
reason='api-deployments-free-per-day'
last_error_seen_at='now'
EOF
set +e
DEPLOY_CALLS="$DEPLOY_CALLS" \
SMA_CLOSEOUT_COOLDOWN_FILE="$COOLDOWN_FILE" \
SMA_CLOSEOUT_DEPLOY_RUNNER_CMD="$FAKE_DEPLOY" \
SMA_CLOSEOUT_MAX_WAIT_SECONDS=30 \
"$WAIT_SCRIPT" fast >"$TMP_DIR/out2.txt" 2>&1
code=$?
set -e
assert_eq "2" "$code" "far cooldown should exit 2"
assert_file_not_exists "$DEPLOY_CALLS" "deploy should not run when max wait exceeded"
assert_contains "$TMP_DIR/out2.txt" "Supera SMA_CLOSEOUT_MAX_WAIT_SECONDS=30" "should explain max wait guard"

# Case 3: force deploy bypasses cooldown
rm -f "$DEPLOY_CALLS"
set +e
DEPLOY_CALLS="$DEPLOY_CALLS" \
SMA_CLOSEOUT_COOLDOWN_FILE="$COOLDOWN_FILE" \
SMA_CLOSEOUT_DEPLOY_RUNNER_CMD="$FAKE_DEPLOY" \
SMA_DEPLOY_FORCE=1 \
"$WAIT_SCRIPT" strict "https://example.test" >"$TMP_DIR/out3.txt" 2>&1
code=$?
set -e
assert_eq "0" "$code" "force should bypass cooldown and execute deploy"
assert_file_exists "$DEPLOY_CALLS" "deploy should run in force mode"
assert_contains "$DEPLOY_CALLS" "^strict https://example\\.test$" "force deploy should preserve args"

# Case 4: short cooldown waits and executes deploy
rm -f "$DEPLOY_CALLS"
near_epoch="$(( $(date +%s) + 1 ))"
near_local="$(date -r "$near_epoch" '+%Y-%m-%d %H:%M:%S %Z')"
cat >"$COOLDOWN_FILE" <<EOF
not_before_epoch=$near_epoch
not_before_local='$near_local'
reason='api-deployments-free-per-day'
last_error_seen_at='now'
EOF
set +e
DEPLOY_CALLS="$DEPLOY_CALLS" \
SMA_CLOSEOUT_COOLDOWN_FILE="$COOLDOWN_FILE" \
SMA_CLOSEOUT_DEPLOY_RUNNER_CMD="$FAKE_DEPLOY" \
SMA_CLOSEOUT_POLL_SECONDS=1 \
SMA_CLOSEOUT_MAX_WAIT_SECONDS=120 \
"$WAIT_SCRIPT" fast >"$TMP_DIR/out4.txt" 2>&1
code=$?
set -e
assert_eq "0" "$code" "near cooldown should wait then run deploy"
assert_file_exists "$DEPLOY_CALLS" "deploy should run after short wait"
assert_contains "$TMP_DIR/out4.txt" "(Ventana abierta -> ejecutando deploy \\+ verificacion|Cooldown expirado/no valido -> ejecutando deploy\\.)" "should report wait-open or immediate-expired path"

echo "[PASS] closeout-wait-and-run tests"
