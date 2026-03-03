#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RUNNER_SCRIPT="$HUB_ROOT/scripts/deploy-and-verify-closeout.sh"

TMP_DIR="$(mktemp -d)"
RUNTIME_DIR="$TMP_DIR/runtime"
mkdir -p "$RUNTIME_DIR"

COOLDOWN_FILE="$RUNTIME_DIR/vercel-deploy-cooldown.env"
STATUS_FILE="$RUNTIME_DIR/deploy-and-verify-last.env"
PUBLISH_CALLS="$TMP_DIR/publish-calls.log"
POST_CALLS="$TMP_DIR/post-calls.log"
FAKE_PUBLISH="$TMP_DIR/fake-publish.sh"
FAKE_POST="$TMP_DIR/fake-post.sh"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

cat >"$FAKE_PUBLISH" <<'EOF'
#!/usr/bin/env bash
echo "$*" >> "${PUBLISH_CALLS:?}"
case "${FAKE_PUBLISH_MODE:-success}" in
  success)
    exit 0
    ;;
  quota)
    echo "api-deployments-free-per-day" >&2
    echo "try again in 7 hours" >&2
    exit 1
    ;;
  fail)
    echo "generic publish error" >&2
    exit 9
    ;;
  *)
    exit 11
    ;;
esac
EOF

cat >"$FAKE_POST" <<'EOF'
#!/usr/bin/env bash
echo "$*" >> "${POST_CALLS:?}"
exit "${FAKE_POST_EXIT:-0}"
EOF

chmod +x "$FAKE_PUBLISH" "$FAKE_POST"

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

assert_file_exists() {
  local file="$1"
  local msg="$2"
  if [[ ! -f "$file" ]]; then
    echo "[FAIL] $msg ($file)"
    exit 1
  fi
}

assert_file_not_exists() {
  local file="$1"
  local msg="$2"
  if [[ -f "$file" ]]; then
    echo "[FAIL] $msg ($file)"
    exit 1
  fi
}

run_runner() {
  local output_file="$1"
  local mode="$2"
  local base_url="$3"
  shift 3 || true

  set +e
  PUBLISH_CALLS="$PUBLISH_CALLS" \
  POST_CALLS="$POST_CALLS" \
  SMA_CLOSEOUT_RUNTIME_DIR="$RUNTIME_DIR" \
  SMA_CLOSEOUT_COOLDOWN_FILE="$COOLDOWN_FILE" \
  SMA_CLOSEOUT_STATUS_FILE="$STATUS_FILE" \
  SMA_CLOSEOUT_PUBLISH_SCRIPT="$FAKE_PUBLISH" \
  SMA_CLOSEOUT_POSTCHECKS_SCRIPT="$FAKE_POST" \
  "$RUNNER_SCRIPT" "$mode" "$base_url" >"$output_file" 2>&1
  local code=$?
  set -e
  echo "$code"
}

rm -f "$PUBLISH_CALLS" "$POST_CALLS" "$COOLDOWN_FILE"

# Case 1: cooldown activo sin force -> exit 2, sin publish
future_epoch="$(( $(date +%s) + 7200 ))"
future_local="$(date -r "$future_epoch" '+%Y-%m-%d %H:%M:%S %Z')"
cat >"$COOLDOWN_FILE" <<EOF
not_before_epoch=$future_epoch
not_before_local='$future_local'
reason='api-deployments-free-per-day'
last_error_seen_at='now'
EOF
code="$(run_runner "$TMP_DIR/out1.txt" fast "https://base.test")"
assert_eq "2" "$code" "active cooldown should block deploy"
assert_file_not_exists "$PUBLISH_CALLS" "publish should not run when guard blocks"
assert_contains "$STATUS_FILE" "^state='guarded_cooldown'$" "guarded run should write guarded status"

# Case 2: force deploy bypassa cooldown -> exit 0
rm -f "$PUBLISH_CALLS" "$POST_CALLS"
set +e
PUBLISH_CALLS="$PUBLISH_CALLS" \
POST_CALLS="$POST_CALLS" \
SMA_CLOSEOUT_RUNTIME_DIR="$RUNTIME_DIR" \
SMA_CLOSEOUT_COOLDOWN_FILE="$COOLDOWN_FILE" \
SMA_CLOSEOUT_STATUS_FILE="$STATUS_FILE" \
SMA_CLOSEOUT_PUBLISH_SCRIPT="$FAKE_PUBLISH" \
SMA_CLOSEOUT_POSTCHECKS_SCRIPT="$FAKE_POST" \
FAKE_PUBLISH_MODE=success \
SMA_DEPLOY_FORCE=1 \
"$RUNNER_SCRIPT" strict "https://force.test" >"$TMP_DIR/out2.txt" 2>&1
code=$?
set -e
assert_eq "0" "$code" "force deploy should run"
assert_contains "$PUBLISH_CALLS" "^strict$" "publish should receive mode"
assert_contains "$POST_CALLS" "^https://force\\.test$" "post-checks should receive base url"
assert_contains "$STATUS_FILE" "^state='success'$" "force success should write success status"

# Case 3: sin cooldown y publish ok -> exit 0, elimina cooldown
rm -f "$PUBLISH_CALLS" "$POST_CALLS" "$COOLDOWN_FILE"
code="$(FAKE_PUBLISH_MODE=success run_runner "$TMP_DIR/out3.txt" fast "https://ok.test")"
assert_eq "0" "$code" "successful flow should exit 0"
assert_contains "$PUBLISH_CALLS" "^fast$" "publish should run in fast mode"
assert_contains "$POST_CALLS" "^https://ok\\.test$" "post-checks should run"
assert_file_not_exists "$COOLDOWN_FILE" "success should clear cooldown file"
assert_contains "$STATUS_FILE" "^state='success'$" "success should write success status"

# Case 4: publish quota error -> exit 3 and writes cooldown
rm -f "$PUBLISH_CALLS" "$POST_CALLS" "$COOLDOWN_FILE"
code="$(FAKE_PUBLISH_MODE=quota run_runner "$TMP_DIR/out4.txt" fast "https://quota.test")"
assert_eq "3" "$code" "quota error should return 3"
assert_file_exists "$COOLDOWN_FILE" "quota error should write cooldown file"
assert_contains "$COOLDOWN_FILE" "^reason='api-deployments-free-per-day'$" "cooldown reason should be recorded"
assert_contains "$STATUS_FILE" "^state='quota_blocked'$" "quota run should write quota status"

# Case 5: publish generic failure -> exit propagated
rm -f "$PUBLISH_CALLS" "$POST_CALLS" "$COOLDOWN_FILE"
code="$(FAKE_PUBLISH_MODE=fail run_runner "$TMP_DIR/out5.txt" fast "https://fail.test")"
assert_eq "9" "$code" "generic publish failure should propagate exit code"
assert_contains "$STATUS_FILE" "^state='publish_failed'$" "publish fail should write publish_failed status"

# Case 6: post-checks failure -> exit propagated and status persisted
rm -f "$PUBLISH_CALLS" "$POST_CALLS" "$COOLDOWN_FILE"
code="$(FAKE_PUBLISH_MODE=success FAKE_POST_EXIT=7 run_runner "$TMP_DIR/out6.txt" fast "https://postfail.test")"
assert_eq "7" "$code" "post-check failure should propagate exit code"
assert_contains "$STATUS_FILE" "^state='post_checks_failed'$" "post-check fail should write post_checks_failed status"

echo "[PASS] deploy-and-verify-closeout tests"
