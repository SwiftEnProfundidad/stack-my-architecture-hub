#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SCHEDULER_SCRIPT="$HUB_ROOT/scripts/schedule-closeout-at.sh"
JOB_SCRIPT="$HUB_ROOT/scripts/closeout-at-job.sh"

TMP_DIR="$(mktemp -d)"
QUEUE_FILE="$TMP_DIR/queue.txt"
CALLS_FILE="$TMP_DIR/calls.txt"
JOBS_DIR="$TMP_DIR/jobs"
mkdir -p "$JOBS_DIR"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

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
JOB_SCRIPT="${FAKE_JOB_SCRIPT:?}"

echo "PATH_SEEN ${PATH:-}" >> "$CALLS_FILE"

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
  printf "%s\tSCHEDULED_BY_EPOCH\n" "$next_id" >> "$QUEUE_FILE"
  printf "%s\n" "$payload" > "$JOBS_DIR/$next_id.body"
  echo "job $next_id at SCHEDULED_BY_EPOCH"
  exit 0
fi

when_token="${1:-}"
echo "AT $when_token" >> "$CALLS_FILE"
next_id=1
if [[ -f "$QUEUE_FILE" ]]; then
  last="$(awk 'END{print $1}' "$QUEUE_FILE" 2>/dev/null || true)"
  if [[ "$last" =~ ^[0-9]+$ ]]; then
    next_id="$((last + 1))"
  fi
fi
printf "%s\tSCHEDULED_%s\n" "$next_id" "$when_token" >> "$QUEUE_FILE"
printf "%s\n" "$payload" > "$JOBS_DIR/$next_id.body"
echo "job $next_id at SCHEDULED_$when_token"
EOF

chmod +x "$TMP_DIR/fake-atq.sh" "$TMP_DIR/fake-atrm.sh" "$TMP_DIR/fake-at.sh"

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

run_scheduler() {
  local output_file="$1"
  shift
  set +e
  FAKE_QUEUE_FILE="$QUEUE_FILE" \
  FAKE_CALLS_FILE="$CALLS_FILE" \
  FAKE_JOBS_DIR="$JOBS_DIR" \
  FAKE_JOB_SCRIPT="$JOB_SCRIPT" \
  SMA_ATQ_CMD="$TMP_DIR/fake-atq.sh" \
  SMA_AT_CMD="$TMP_DIR/fake-at.sh" \
  SMA_ATRM_CMD="$TMP_DIR/fake-atrm.sh" \
  "$SCHEDULER_SCRIPT" "$@" >"$output_file" 2>&1
  local code=$?
  set -e
  echo "$code"
}

run_scheduler_force_sanitize() {
  local output_file="$1"
  shift
  set +e
  FAKE_QUEUE_FILE="$QUEUE_FILE" \
  FAKE_CALLS_FILE="$CALLS_FILE" \
  FAKE_JOBS_DIR="$JOBS_DIR" \
  FAKE_JOB_SCRIPT="$JOB_SCRIPT" \
  PATH="/tmp/leaky-bin:${PATH:-}" \
  TEST_SECRET="super-secret-value" \
  SMA_ATQ_CMD="$TMP_DIR/fake-atq.sh" \
  SMA_AT_CMD="$TMP_DIR/fake-at.sh" \
  SMA_ATRM_CMD="$TMP_DIR/fake-atrm.sh" \
  SMA_AT_FORCE_SANITIZE="1" \
  SMA_AT_SANITIZED_PATH="/usr/bin:/bin:/usr/sbin:/sbin" \
  "$SCHEDULER_SCRIPT" "$@" >"$output_file" 2>&1
  local code=$?
  set -e
  echo "$code"
}

rm -f "$QUEUE_FILE" "$CALLS_FILE"

# Case 1: schedule by human time
code="$(run_scheduler "$TMP_DIR/out1.txt" "15:50")"
[[ "$code" -eq 0 ]] || { echo "[FAIL] case1 exit=$code"; cat "$TMP_DIR/out1.txt"; exit 1; }
assert_contains "$CALLS_FILE" "^AT 15:50$" "debe programar con hora textual"
assert_contains "$QUEUE_FILE" "^1[[:space:]]+SCHEDULED_15:50$" "debe crear primer job"
assert_contains "$TMP_DIR/out1.txt" "Scheduled closeout job at: 15:50" "debe informar hora programada"

# Inject old closeout job and non-closeout job
printf "2\tOLD_JOB\n3\tOTHER_JOB\n" >> "$QUEUE_FILE"
printf "%s\n" "/tmp/scripts/closeout-at-job.sh" > "$JOBS_DIR/2.body"
printf "%s\n" "echo unrelated" > "$JOBS_DIR/3.body"

# Case 2: schedule by epoch (should remove old closeout job only)
future_epoch="$(( $(date +%s) + 7200 ))"
code="$(run_scheduler "$TMP_DIR/out2.txt" "--epoch" "$future_epoch")"
[[ "$code" -eq 0 ]] || { echo "[FAIL] case2 exit=$code"; cat "$TMP_DIR/out2.txt"; exit 1; }
assert_contains "$CALLS_FILE" "^ATRM 2$" "debe eliminar job closeout previo"
assert_not_contains "$CALLS_FILE" "^ATRM 3$" "no debe eliminar jobs no-closeout"
assert_contains "$CALLS_FILE" "^AT -t [0-9]{12}\\.[0-9]{2}$" "debe programar con -t en modo epoch"
assert_contains "$TMP_DIR/out2.txt" "Scheduled closeout job at epoch" "debe informar programación epoch"

# Case 3: invalid epoch
code="$(run_scheduler "$TMP_DIR/out3.txt" "--epoch" "abc")"
[[ "$code" -eq 1 ]] || { echo "[FAIL] case3 exit=$code"; cat "$TMP_DIR/out3.txt"; exit 1; }
assert_contains "$TMP_DIR/out3.txt" "--epoch requiere segundos unix validos" "debe validar epoch inválido"

# Case 4: force sanitize env avoids secret leak to AT_CMD process
rm -f "$CALLS_FILE"
code="$(run_scheduler_force_sanitize "$TMP_DIR/out4.txt" "16:10")"
[[ "$code" -eq 0 ]] || { echo "[FAIL] case4 exit=$code"; cat "$TMP_DIR/out4.txt"; exit 1; }
assert_not_contains "$CALLS_FILE" "SECRET_LEAK" "no debe propagar secretos al proceso at en modo saneado"
assert_contains "$CALLS_FILE" "^PATH_SEEN /usr/bin:/bin:/usr/sbin:/sbin$" "debe usar PATH saneado fijo"
assert_not_contains "$CALLS_FILE" "leaky-bin" "no debe heredar PATH interactivo en modo saneado"

echo "[PASS] schedule-closeout-at tests"
