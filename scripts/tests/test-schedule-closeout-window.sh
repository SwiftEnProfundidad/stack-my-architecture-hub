#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WINDOW_SCRIPT="$HUB_ROOT/scripts/schedule-closeout-window.sh"
RECOVER_SCRIPT="$HUB_ROOT/scripts/recover-past-due-closeout.sh"
FOLLOWUP_SCRIPT="$HUB_ROOT/scripts/closeout-window-followup.sh"

TMP_DIR="$(mktemp -d)"
RUNTIME_DIR="$TMP_DIR/runtime"
COOLDOWN_FILE="$RUNTIME_DIR/vercel-deploy-cooldown.env"
QUEUE_FILE="$TMP_DIR/queue.txt"
CALLS_FILE="$TMP_DIR/calls.txt"
JOBS_DIR="$TMP_DIR/jobs"
mkdir -p "$RUNTIME_DIR" "$JOBS_DIR"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

cat >"$TMP_DIR/fake-scheduler.sh" <<'EOF'
#!/usr/bin/env bash
CALLS_FILE="${FAKE_CALLS_FILE:?}"
echo "SCHED $*" >> "$CALLS_FILE"
exit 0
EOF

cat >"$TMP_DIR/fake-atq.sh" <<'EOF'
#!/usr/bin/env bash
QUEUE_FILE="${FAKE_QUEUE_FILE:?}"
if [[ -f "$QUEUE_FILE" ]]; then
  cat "$QUEUE_FILE"
fi
EOF

cat >"$TMP_DIR/fake-atrm.sh" <<'EOF'
#!/usr/bin/env bash
CALLS_FILE="${FAKE_CALLS_FILE:?}"
QUEUE_FILE="${FAKE_QUEUE_FILE:?}"
job_id="${1:?}"
echo "ATRM $job_id" >> "$CALLS_FILE"
if [[ -f "$QUEUE_FILE" ]]; then
  grep -v "^${job_id}[[:space:]]" "$QUEUE_FILE" > "$QUEUE_FILE.tmp" || true
  mv "$QUEUE_FILE.tmp" "$QUEUE_FILE"
fi
EOF

cat >"$TMP_DIR/fake-at.sh" <<'EOF'
#!/usr/bin/env bash
CALLS_FILE="${FAKE_CALLS_FILE:?}"
QUEUE_FILE="${FAKE_QUEUE_FILE:?}"
JOBS_DIR="${FAKE_JOBS_DIR:?}"

if [[ -n "${TEST_SECRET:-}" ]]; then
  echo "SECRET_LEAK ${TEST_SECRET}" >> "$CALLS_FILE"
fi

if [[ "${1:-}" == "-c" ]]; then
  job_id="${2:?}"
  if [[ -f "$JOBS_DIR/$job_id.body" ]]; then
    cat "$JOBS_DIR/$job_id.body"
  fi
  exit 0
fi

payload="$(cat)"
if [[ "${1:-}" == "-t" ]]; then
  time_token="${2:?}"
  echo "AT -t $time_token" >> "$CALLS_FILE"
  next_id=1
  if [[ -f "$QUEUE_FILE" ]]; then
    last="$(awk 'END{print $1}' "$QUEUE_FILE" 2>/dev/null || true)"
    if [[ "$last" =~ ^[0-9]+$ ]]; then
      next_id="$((last + 1))"
    fi
  fi
  printf "%s\tWATCHDOG\n" "$next_id" >> "$QUEUE_FILE"
  printf "%s\n" "$payload" > "$JOBS_DIR/$next_id.body"
  echo "job $next_id at WATCHDOG"
  exit 0
fi

echo "unsupported fake-at call" >&2
exit 11
EOF

chmod +x "$TMP_DIR/fake-scheduler.sh" "$TMP_DIR/fake-atq.sh" "$TMP_DIR/fake-atrm.sh" "$TMP_DIR/fake-at.sh"

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

run_window() {
  local output_file="$1"
  shift
  set +e
  FAKE_CALLS_FILE="$CALLS_FILE" \
  FAKE_QUEUE_FILE="$QUEUE_FILE" \
  FAKE_JOBS_DIR="$JOBS_DIR" \
  SMA_CLOSEOUT_COOLDOWN_FILE="$COOLDOWN_FILE" \
  SMA_CLOSEOUT_SCHEDULER_CMD="$TMP_DIR/fake-scheduler.sh" \
  SMA_CLOSEOUT_RECOVER_SCRIPT="$RECOVER_SCRIPT" \
  SMA_CLOSEOUT_FOLLOWUP_SCRIPT="$FOLLOWUP_SCRIPT" \
  SMA_ATQ_CMD="$TMP_DIR/fake-atq.sh" \
  SMA_AT_CMD="$TMP_DIR/fake-at.sh" \
  SMA_ATRM_CMD="$TMP_DIR/fake-atrm.sh" \
  "$WINDOW_SCRIPT" "$@" >"$output_file" 2>&1
  local code=$?
  set -e
  echo "$code"
}

run_window_force_sanitize() {
  local output_file="$1"
  shift
  set +e
  FAKE_CALLS_FILE="$CALLS_FILE" \
  FAKE_QUEUE_FILE="$QUEUE_FILE" \
  FAKE_JOBS_DIR="$JOBS_DIR" \
  TEST_SECRET="window-secret" \
  SMA_CLOSEOUT_COOLDOWN_FILE="$COOLDOWN_FILE" \
  SMA_CLOSEOUT_SCHEDULER_CMD="$TMP_DIR/fake-scheduler.sh" \
  SMA_CLOSEOUT_RECOVER_SCRIPT="$RECOVER_SCRIPT" \
  SMA_CLOSEOUT_FOLLOWUP_SCRIPT="$FOLLOWUP_SCRIPT" \
  SMA_ATQ_CMD="$TMP_DIR/fake-atq.sh" \
  SMA_AT_CMD="$TMP_DIR/fake-at.sh" \
  SMA_ATRM_CMD="$TMP_DIR/fake-atrm.sh" \
  SMA_AT_FORCE_SANITIZE="1" \
  "$WINDOW_SCRIPT" "$@" >"$output_file" 2>&1
  local code=$?
  set -e
  echo "$code"
}

rm -f "$CALLS_FILE" "$QUEUE_FILE"

now_epoch="$(date +%s)"
not_before_epoch="$((now_epoch + 3600))"
not_before_local="$(date -r "$not_before_epoch" '+%Y-%m-%d %H:%M:%S %Z')"
main_epoch="$((not_before_epoch + 60))"
watchdog_epoch="$((main_epoch + 120))"
followup_epoch="$((main_epoch + 240))"
watchdog_token="$(date -r "$watchdog_epoch" '+%Y%m%d%H%M.%S')"
followup_token="$(date -r "$followup_epoch" '+%Y%m%d%H%M.%S')"

# Case 1: schedule using cooldown + remove old watchdog/followup
cat >"$COOLDOWN_FILE" <<EOF
not_before_epoch=$not_before_epoch
not_before_local='$not_before_local'
reason='api-deployments-free-per-day'
last_error_seen_at='now'
EOF
printf "5\tOLD_WATCHDOG\n6\tOLD_FOLLOWUP\n7\tOTHER\n" > "$QUEUE_FILE"
printf "%s\n" "/tmp/scripts/recover-past-due-closeout.sh" > "$JOBS_DIR/5.body"
printf "%s\n" "/tmp/scripts/closeout-window-followup.sh" > "$JOBS_DIR/6.body"
printf "%s\n" "echo noop" > "$JOBS_DIR/7.body"

code="$(run_window "$TMP_DIR/out1.txt")"
[[ "$code" -eq 0 ]] || { echo "[FAIL] case1 exit=$code"; cat "$TMP_DIR/out1.txt"; exit 1; }
assert_contains "$CALLS_FILE" "^SCHED --epoch ${main_epoch}$" "debe programar main por epoch derivado"
assert_contains "$CALLS_FILE" "^ATRM 5$" "debe eliminar watchdog anterior"
assert_contains "$CALLS_FILE" "^ATRM 6$" "debe eliminar followup anterior"
assert_not_contains "$CALLS_FILE" "^ATRM 7$" "no debe eliminar jobs no-watchdog/no-followup"
assert_contains "$CALLS_FILE" "^AT -t ${watchdog_token}$" "debe programar watchdog con epoch esperado"
assert_contains "$CALLS_FILE" "^AT -t ${followup_token}$" "debe programar followup con epoch esperado"
assert_contains "$JOBS_DIR/8.body" "recover-past-due-closeout\\.sh" "payload watchdog debe ejecutar recovery"
assert_contains "$JOBS_DIR/9.body" "closeout-window-followup\\.sh" "payload followup debe ejecutar snapshot"

# Case 2: explicit --epoch should work without cooldown file
rm -f "$CALLS_FILE" "$COOLDOWN_FILE"
rm -f "$QUEUE_FILE"
base_epoch2="$((now_epoch + 7200))"
main_epoch2="$((base_epoch2 + 60))"
watchdog_epoch2="$((main_epoch2 + 120))"
followup_epoch2="$((main_epoch2 + 240))"
watchdog_token2="$(date -r "$watchdog_epoch2" '+%Y%m%d%H%M.%S')"
followup_token2="$(date -r "$followup_epoch2" '+%Y%m%d%H%M.%S')"
code="$(run_window "$TMP_DIR/out2.txt" --epoch "$base_epoch2")"
[[ "$code" -eq 0 ]] || { echo "[FAIL] case2 exit=$code"; cat "$TMP_DIR/out2.txt"; exit 1; }
assert_contains "$CALLS_FILE" "^SCHED --epoch ${main_epoch2}$" "debe respetar epoch explícito para main"
assert_contains "$CALLS_FILE" "^AT -t ${watchdog_token2}$" "debe programar watchdog desde epoch explícito"
assert_contains "$CALLS_FILE" "^AT -t ${followup_token2}$" "debe programar followup desde epoch explícito"

# Case 3: sanitize mode should avoid leaking TEST_SECRET to fake-at
rm -f "$CALLS_FILE"
code="$(run_window_force_sanitize "$TMP_DIR/out3.txt" --epoch "$base_epoch2")"
[[ "$code" -eq 0 ]] || { echo "[FAIL] case3 exit=$code"; cat "$TMP_DIR/out3.txt"; exit 1; }
assert_not_contains "$CALLS_FILE" "SECRET_LEAK" "no debe filtrar TEST_SECRET con saneado forzado"

echo "[PASS] schedule-closeout-window tests"
