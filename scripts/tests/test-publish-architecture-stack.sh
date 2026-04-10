#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RUNNER_SCRIPT="$HUB_ROOT/scripts/publish-architecture-stack.sh"

TMP_DIR="$(mktemp -d)"
RUNTIME_DIR="$TMP_DIR/runtime"
mkdir -p "$RUNTIME_DIR"

COOLDOWN_FILE="$RUNTIME_DIR/vercel-deploy-cooldown.env"
BUILD_CALLS="$TMP_DIR/build-calls.log"
DEPLOY_CALLS="$TMP_DIR/deploy-calls.log"
CURL_CALLS="$TMP_DIR/curl-calls.log"
FAKE_BUILD="$TMP_DIR/fake-build.sh"
FAKE_DEPLOY="$TMP_DIR/fake-deploy.sh"
FAKE_CURL="$TMP_DIR/fake-curl.sh"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

cat >"$FAKE_BUILD" <<'EOF'
#!/usr/bin/env bash
echo "$*" >> "${BUILD_CALLS:?}"
exit 0
EOF

cat >"$FAKE_DEPLOY" <<'EOF'
#!/usr/bin/env bash
echo "deploy" >> "${DEPLOY_CALLS:?}"
case "${FAKE_DEPLOY_MODE:-success}" in
  success)
    echo "Production: https://example-preview.vercel.app"
    echo "Aliased: https://stack-my-architecture-hub.vercel.app [1s]"
    exit 0
    ;;
  quota)
    echo "api-deployments-free-per-day" >&2
    echo "try again in 5 hours" >&2
    exit 1
    ;;
  fail)
    echo "generic deploy error" >&2
    exit 9
    ;;
esac
EOF

cat >"$FAKE_CURL" <<'EOF'
#!/usr/bin/env bash
echo "$*" >> "${CURL_CALLS:?}"
printf '200'
EOF

chmod +x "$FAKE_BUILD" "$FAKE_DEPLOY" "$FAKE_CURL"

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
  set +e
  BUILD_CALLS="$BUILD_CALLS" \
  DEPLOY_CALLS="$DEPLOY_CALLS" \
  CURL_CALLS="$CURL_CALLS" \
  SMA_CLOSEOUT_RUNTIME_DIR="$RUNTIME_DIR" \
  SMA_CLOSEOUT_COOLDOWN_FILE="$COOLDOWN_FILE" \
  SMA_PUBLISH_BUILD_SCRIPT="$FAKE_BUILD" \
  SMA_PUBLISH_DEPLOY_CMD="$FAKE_DEPLOY" \
  SMA_PUBLISH_CURL_BIN="$FAKE_CURL" \
  SMA_PUBLISH_BASE_URL="https://architecture-stack.vercel.app" \
  "$RUNNER_SCRIPT" "$mode" >"$output_file" 2>&1
  local code=$?
  set -e
  echo "$code"
}

rm -f "$BUILD_CALLS" "$DEPLOY_CALLS" "$CURL_CALLS" "$COOLDOWN_FILE"

# Case 1: cooldown activo sin force -> exit 2, sin build ni deploy
future_epoch="$(( $(date +%s) + 7200 ))"
future_local="$(date -r "$future_epoch" '+%Y-%m-%d %H:%M:%S %Z')"
cat >"$COOLDOWN_FILE" <<EOF
not_before_epoch=$future_epoch
not_before_local='$future_local'
reason='api-deployments-free-per-day'
last_error_seen_at='now'
EOF
code="$(run_runner "$TMP_DIR/out1.txt" fast)"
assert_eq "2" "$code" "active cooldown should block publish"
assert_file_not_exists "$BUILD_CALLS" "build should not run when cooldown guard blocks"
assert_file_not_exists "$DEPLOY_CALLS" "deploy should not run when cooldown guard blocks"

# Case 2: force deploy bypassa cooldown -> exit 0
rm -f "$BUILD_CALLS" "$DEPLOY_CALLS" "$CURL_CALLS"
set +e
BUILD_CALLS="$BUILD_CALLS" \
DEPLOY_CALLS="$DEPLOY_CALLS" \
CURL_CALLS="$CURL_CALLS" \
SMA_CLOSEOUT_RUNTIME_DIR="$RUNTIME_DIR" \
SMA_CLOSEOUT_COOLDOWN_FILE="$COOLDOWN_FILE" \
SMA_PUBLISH_BUILD_SCRIPT="$FAKE_BUILD" \
SMA_PUBLISH_DEPLOY_CMD="$FAKE_DEPLOY" \
SMA_PUBLISH_CURL_BIN="$FAKE_CURL" \
SMA_PUBLISH_BASE_URL="https://architecture-stack.vercel.app" \
SMA_DEPLOY_FORCE=1 \
"$RUNNER_SCRIPT" strict >"$TMP_DIR/out2.txt" 2>&1
code=$?
set -e
assert_eq "0" "$code" "force publish should run"
assert_contains "$BUILD_CALLS" "^--mode strict$" "build should receive strict mode"
assert_contains "$DEPLOY_CALLS" "deploy" "deploy should run in force mode"
assert_contains "$CURL_CALLS" "https://stack-my-architecture-hub\\.vercel\\.app/ios/" "route verification should follow Aliased production URL"
assert_file_exists "$RUNTIME_DIR/publish-verify-base.url" "verify base should persist for postchecks"
assert_eq "https://stack-my-architecture-hub.vercel.app" "$(tr -d '\r\n' <"$RUNTIME_DIR/publish-verify-base.url")" "persisted verify base should match Aliased URL"

# Case 3: success clears cooldown
rm -f "$BUILD_CALLS" "$DEPLOY_CALLS" "$CURL_CALLS" "$COOLDOWN_FILE"
code="$(FAKE_DEPLOY_MODE=success run_runner "$TMP_DIR/out3.txt" fast)"
assert_eq "0" "$code" "successful publish should exit 0"
assert_file_not_exists "$COOLDOWN_FILE" "success should clear cooldown file"

# Case 4: quota deploy writes cooldown and exits 3
rm -f "$BUILD_CALLS" "$DEPLOY_CALLS" "$CURL_CALLS" "$COOLDOWN_FILE"
code="$(FAKE_DEPLOY_MODE=quota run_runner "$TMP_DIR/out4.txt" fast)"
assert_eq "3" "$code" "quota error should return 3"
assert_file_exists "$COOLDOWN_FILE" "quota should write cooldown file"
assert_contains "$COOLDOWN_FILE" "^reason='api-deployments-free-per-day'$" "cooldown reason should be recorded"

# Case 5: generic deploy failure propagates
rm -f "$BUILD_CALLS" "$DEPLOY_CALLS" "$CURL_CALLS" "$COOLDOWN_FILE"
code="$(FAKE_DEPLOY_MODE=fail run_runner "$TMP_DIR/out5.txt" fast)"
assert_eq "9" "$code" "generic deploy failure should propagate"

echo "[PASS] publish-architecture-stack tests"
