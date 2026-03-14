#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FREEZE_SCRIPT="$HUB_ROOT/scripts/closeout-freeze-check.sh"

TMP_DIR="$(mktemp -d)"
RUNTIME_DIR="$TMP_DIR/runtime"
REPORT_1="$TMP_DIR/report-not-ready.md"
REPORT_2="$TMP_DIR/report-ready.md"
DEPLOY_STATUS_FILE="$RUNTIME_DIR/deploy-and-verify-last.env"
FOLLOWUP_LOG="$RUNTIME_DIR/closeout-followup-20260303T161200.log"
COMPLETE_FLAG="$RUNTIME_DIR/closeout-complete.flag"

FAKE_STATUS="$TMP_DIR/fake-status.sh"
FAKE_READINESS="$TMP_DIR/fake-readiness.sh"
FAKE_ATQ="$TMP_DIR/fake-atq.sh"

mkdir -p "$RUNTIME_DIR"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

cat >"$FAKE_STATUS" <<'EOF'
#!/usr/bin/env bash
echo "status: stub"
exit "${FAKE_STATUS_EXIT:-2}"
EOF

cat >"$FAKE_READINESS" <<'EOF'
#!/usr/bin/env bash
echo "readiness: stub"
exit "${FAKE_READINESS_EXIT:-2}"
EOF

cat >"$FAKE_ATQ" <<'EOF'
#!/usr/bin/env bash
echo "18 Tue Mar 3 16:08:00 2026"
exit 0
EOF

chmod +x "$FAKE_STATUS" "$FAKE_READINESS" "$FAKE_ATQ"

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

run_freeze_check() {
  local output_file="$1"
  local report_file="$2"
  shift 2 || true
  set +e
  SMA_CLOSEOUT_RUNTIME_DIR="$RUNTIME_DIR" \
  SMA_CLOSEOUT_STATUS_CMD="$FAKE_STATUS" \
  SMA_CLOSEOUT_READINESS_CMD="$FAKE_READINESS" \
  SMA_ATQ_CMD="$FAKE_ATQ" \
  SMA_CLOSEOUT_FREEZE_REPORT_FILE="$report_file" \
  "$FREEZE_SCRIPT" >"$output_file" 2>&1
  local code=$?
  set -e
  echo "$code"
}

# Case 1: NOT_READY by default (missing files)
code="$(run_freeze_check "$TMP_DIR/out1.txt" "$REPORT_1")"
assert_eq "2" "$code" "missing artifacts should return not-ready"
assert_contains "$TMP_DIR/out1.txt" "\\[FREEZE-CHECK\\] Result: NOT_READY" "stdout should print not-ready"
assert_contains "$REPORT_1" "Result: NOT_READY" "report should contain not-ready"
assert_contains "$REPORT_1" "deploy-status-missing" "report should include missing deploy status reason"
assert_contains "$REPORT_1" "closeout-complete-flag-missing" "report should include missing flag reason"
assert_contains "$REPORT_1" "followup-log-missing" "report should include missing followup reason"

# Case 2: READY when all conditions are satisfied
cat >"$DEPLOY_STATUS_FILE" <<'EOF'
state='success'
mode='fast'
base_url='https://architecture-stack.vercel.app'
EOF
touch "$COMPLETE_FLAG"
cat >"$FOLLOWUP_LOG" <<'EOF'
[FOLLOWUP] smoke-public-routes exit=0
[FOLLOWUP] smoke-public-functional exit=0
[FOLLOWUP] post-deploy-checks exit=0
EOF

code="$(run_freeze_check "$TMP_DIR/out2.txt" "$REPORT_2")"
assert_eq "0" "$code" "full success artifacts should return ready"
assert_contains "$TMP_DIR/out2.txt" "\\[FREEZE-CHECK\\] Result: READY" "stdout should print ready"
assert_contains "$REPORT_2" "Result: READY" "report should contain ready"
assert_contains "$REPORT_2" "Deploy state success: ✅" "report should mark deploy success"
assert_contains "$REPORT_2" "Followup routes check: ✅" "report should mark routes success"
assert_contains "$REPORT_2" "Followup functional check: ✅" "report should mark functional success"
assert_contains "$REPORT_2" "Followup post-checks: ✅" "report should mark post checks success"

echo "[PASS] closeout-freeze-check tests"
