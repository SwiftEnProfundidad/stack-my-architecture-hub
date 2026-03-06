#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
JOB_SCRIPT="$HUB_ROOT/scripts/closeout-at-job.sh"

TMP_DIR="$(mktemp -d)"
RUNTIME_DIR="$TMP_DIR/runtime"
TMP_JOB_DIR="$TMP_DIR/job-copy"
mkdir -p "$RUNTIME_DIR" "$TMP_JOB_DIR"

FAKE_WAIT="$TMP_DIR/fake-wait.sh"
FAKE_SCHEDULER="$TMP_DIR/fake-scheduler.sh"
DEFAULT_SCHED_CALLS="$TMP_DIR/default-scheduler-calls.log"
SCHED_CALLS="$TMP_DIR/scheduler-calls.log"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

cat >"$FAKE_WAIT" <<'EOF'
#!/usr/bin/env bash
exit "${FAKE_WAIT_EXIT:-0}"
EOF

cat >"$FAKE_SCHEDULER" <<'EOF'
#!/usr/bin/env bash
echo "$*" >> "${SCHED_CALLS:?}"
exit 0
EOF

cp "$JOB_SCRIPT" "$TMP_JOB_DIR/closeout-at-job.sh"
chmod +x "$TMP_JOB_DIR/closeout-at-job.sh"

cat >"$TMP_JOB_DIR/schedule-closeout-window.sh" <<'EOF'
#!/usr/bin/env bash
echo "$*" >> "${DEFAULT_SCHED_CALLS:?}"
exit 0
EOF

chmod +x "$TMP_JOB_DIR/schedule-closeout-window.sh"

chmod +x "$FAKE_WAIT" "$FAKE_SCHEDULER"

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

run_job() {
  local wait_exit="$1"
  local auto_reschedule="$2"
  local offset="$3"
  shift 3 || true

  set +e
  FAKE_WAIT_EXIT="$wait_exit" \
  SCHED_CALLS="$SCHED_CALLS" \
  SMA_CLOSEOUT_RUNTIME_DIR="$RUNTIME_DIR" \
  SMA_CLOSEOUT_WAIT_RUNNER_CMD="$FAKE_WAIT" \
  SMA_CLOSEOUT_SCHEDULER_CMD="$FAKE_SCHEDULER" \
  SMA_CLOSEOUT_AUTO_RESCHEDULE="$auto_reschedule" \
  SMA_CLOSEOUT_RESCHEDULE_OFFSET_SECONDS="$offset" \
  "$JOB_SCRIPT"
  local code=$?
  set -e
  echo "$code"
}

run_job_with_default_scheduler() {
  local wait_exit="$1"
  local auto_reschedule="$2"
  local offset="$3"

  set +e
  FAKE_WAIT_EXIT="$wait_exit" \
  DEFAULT_SCHED_CALLS="$DEFAULT_SCHED_CALLS" \
  SMA_CLOSEOUT_RUNTIME_DIR="$RUNTIME_DIR" \
  SMA_CLOSEOUT_WAIT_RUNNER_CMD="$FAKE_WAIT" \
  SMA_CLOSEOUT_AUTO_RESCHEDULE="$auto_reschedule" \
  SMA_CLOSEOUT_RESCHEDULE_OFFSET_SECONDS="$offset" \
  "$TMP_JOB_DIR/closeout-at-job.sh"
  local code=$?
  set -e
  echo "$code"
}

STATUS_FILE="$RUNTIME_DIR/auto-closeout-status.env"
COOLDOWN_FILE="$RUNTIME_DIR/vercel-deploy-cooldown.env"
COMPLETE_FLAG="$RUNTIME_DIR/closeout-complete.flag"

# Case 1: success -> complete flag present, no scheduler call
rm -f "$SCHED_CALLS" "$COOLDOWN_FILE" "$COMPLETE_FLAG" "$STATUS_FILE"
code="$(run_job 0 1 60)"
assert_eq "0" "$code" "success should exit 0"
assert_file_exists "$COMPLETE_FLAG" "success should create complete flag"
assert_file_exists "$STATUS_FILE" "status file must exist"
# shellcheck disable=SC1090
source "$STATUS_FILE"
assert_eq "0" "${last_exit_code:-}" "status must record successful exit"
assert_eq "1" "${auto_reschedule:-}" "status should record auto_reschedule=1"
assert_eq "" "${next_retry_epoch:-}" "success should not set next retry epoch"
assert_file_not_exists "$SCHED_CALLS" "success should not call scheduler"

# Case 2: failure + auto reschedule -> scheduler called with epoch
rm -f "$SCHED_CALLS" "$COMPLETE_FLAG"
not_before_epoch="$(( $(date +%s) + 3600 ))"
cat >"$COOLDOWN_FILE" <<EOF
not_before_epoch=$not_before_epoch
not_before_local='future-window'
reason='api-deployments-free-per-day'
last_error_seen_at='now'
EOF
offset=90
expected_next="$((not_before_epoch + offset))"
code="$(run_job 2 1 "$offset")"
assert_eq "2" "$code" "failure should bubble wait-runner exit"
assert_file_not_exists "$COMPLETE_FLAG" "failure should remove complete flag"
assert_file_exists "$SCHED_CALLS" "auto reschedule should call scheduler"
if ! rg -q -- "^--epoch ${expected_next}$" "$SCHED_CALLS"; then
  echo "[FAIL] scheduler should be called with expected epoch"
  cat "$SCHED_CALLS"
  exit 1
fi
# shellcheck disable=SC1090
source "$STATUS_FILE"
assert_eq "2" "${last_exit_code:-}" "status must record failed exit"
assert_eq "1" "${auto_reschedule:-}" "status should record auto_reschedule=1"
assert_eq "$expected_next" "${next_retry_epoch:-}" "status should record computed next epoch"
assert_eq "api-deployments-free-per-day" "${next_retry_reason:-}" "status should capture reason"

# Case 3: failure + auto reschedule disabled -> no scheduler call
rm -f "$SCHED_CALLS" "$COMPLETE_FLAG"
code="$(run_job 2 0 60)"
assert_eq "2" "$code" "failure should exit 2 when auto disabled"
assert_file_not_exists "$SCHED_CALLS" "auto disabled should not call scheduler"
# shellcheck disable=SC1090
source "$STATUS_FILE"
assert_eq "0" "${auto_reschedule:-}" "status should record auto_reschedule=0"
assert_eq "" "${next_retry_epoch:-}" "no next retry when auto disabled"

# Case 4: failure + default scheduler should use schedule-closeout-window.sh
rm -f "$DEFAULT_SCHED_CALLS" "$COMPLETE_FLAG"
not_before_epoch_default="$(( $(date +%s) + 2400 ))"
cat >"$COOLDOWN_FILE" <<EOF
not_before_epoch=$not_before_epoch_default
not_before_local='future-window-default'
reason='api-deployments-free-per-day'
last_error_seen_at='now'
EOF
offset_default=75
expected_default_next="$((not_before_epoch_default + offset_default))"
code="$(run_job_with_default_scheduler 2 1 "$offset_default")"
assert_eq "2" "$code" "failure should bubble wait-runner exit with default scheduler"
assert_file_exists "$DEFAULT_SCHED_CALLS" "default scheduler should be invoked"
if ! rg -q -- "^--epoch ${expected_default_next}$" "$DEFAULT_SCHED_CALLS"; then
  echo "[FAIL] default scheduler should be called with expected epoch"
  cat "$DEFAULT_SCHED_CALLS"
  exit 1
fi

echo "[PASS] closeout-at-job tests"
