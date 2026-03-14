#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RUNNER_SCRIPT="$HUB_ROOT/scripts/run-closeout-qa-suite.sh"

TMP_DIR="$(mktemp -d)"
TESTS_FILE="$TMP_DIR/tests.list"
PASS_TEST="$TMP_DIR/fake-pass-test.sh"
FAKE_ATQ="$TMP_DIR/fake-atq.sh"
FAKE_STATUS="$TMP_DIR/fake-status.sh"
FAKE_READINESS="$TMP_DIR/fake-readiness.sh"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

cat >"$PASS_TEST" <<'EOF'
#!/usr/bin/env bash
echo "[PASS] fake closeout suite test"
EOF

cat >"$FAKE_ATQ" <<'EOF'
#!/usr/bin/env bash
echo "42 Tue Mar 3 16:08:00 2026"
EOF

cat >"$FAKE_STATUS" <<'EOF'
#!/usr/bin/env bash
echo "status stub"
exit "${FAKE_STATUS_EXIT:-0}"
EOF

cat >"$FAKE_READINESS" <<'EOF'
#!/usr/bin/env bash
echo "readiness stub"
exit "${FAKE_READINESS_EXIT:-0}"
EOF

chmod +x "$PASS_TEST" "$FAKE_ATQ" "$FAKE_STATUS" "$FAKE_READINESS"
printf "%s\n" "$PASS_TEST" > "$TESTS_FILE"

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

assert_not_contains() {
  local file="$1"
  local pattern="$2"
  local msg="$3"
  if rg -q -- "$pattern" "$file"; then
    echo "[FAIL] $msg (pattern='$pattern')"
    echo "--- $file ---"
    cat "$file"
    exit 1
  fi
}

run_runner() {
  local output_file="$1"
  local mode="$2"
  local status_exit="$3"
  local readiness_exit="$4"
  set +e
  SMA_CLOSEOUT_QA_TESTS_FILE="$TESTS_FILE" \
  SMA_ATQ_CMD="$FAKE_ATQ" \
  SMA_CLOSEOUT_STATUS_CMD="$FAKE_STATUS" \
  SMA_CLOSEOUT_READINESS_CMD="$FAKE_READINESS" \
  FAKE_STATUS_EXIT="$status_exit" \
  FAKE_READINESS_EXIT="$readiness_exit" \
  "$RUNNER_SCRIPT" "$mode" >"$output_file" 2>&1
  local code=$?
  set -e
  echo "$code"
}

# Case 1: full mode with status=2 and readiness=2 should pass
code="$(run_runner "$TMP_DIR/out1.txt" "full" "2" "2")"
assert_eq "0" "$code" "full should pass on waiting status/readiness"
assert_contains "$TMP_DIR/out1.txt" "closeout-status -> EN ESPERA por cooldown \(2\)" "must report waiting status"
assert_contains "$TMP_DIR/out1.txt" "closeout-readiness -> EN ESPERA por cooldown \(2\)" "must report waiting readiness"

# Case 2: full mode with status=3 should fail fast
code="$(run_runner "$TMP_DIR/out2.txt" "full" "3" "2")"
assert_eq "3" "$code" "full should fail on incomplete status window"
assert_contains "$TMP_DIR/out2.txt" "ERROR: cooldown activo con ventana incompleta \(3\)" "must flag incomplete window"

# Case 3: full mode with readiness=3 should fail
code="$(run_runner "$TMP_DIR/out3.txt" "full" "2" "3")"
assert_eq "3" "$code" "full should fail on readiness=3"
assert_contains "$TMP_DIR/out3.txt" "ERROR: cooldown activo sin job automático en cola \(3\)" "must preserve readiness guard error"

# Case 4: tests mode should not run runtime checks
code="$(run_runner "$TMP_DIR/out4.txt" "tests" "3" "3")"
assert_eq "0" "$code" "tests mode should ignore runtime checks"
assert_not_contains "$TMP_DIR/out4.txt" "Runtime check:" "tests mode must skip runtime section"

echo "[PASS] run-closeout-qa-suite tests"
