#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RECOVER_SCRIPT="$HUB_ROOT/scripts/recover-past-due-closeout.sh"

TMP_DIR="$(mktemp -d)"
RUNTIME_DIR="$TMP_DIR/runtime"
COOLDOWN_FILE="$RUNTIME_DIR/vercel-deploy-cooldown.env"
QUEUE_FILE="$TMP_DIR/queue.txt"
CALLS_FILE="$TMP_DIR/calls.txt"
JOBS_DIR="$TMP_DIR/jobs"
FALLBACK_CALLS="$TMP_DIR/fallback-calls.txt"
mkdir -p "$RUNTIME_DIR" "$JOBS_DIR"

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

cat >"$TMP_DIR/fake-at.sh" <<'EOF'
#!/usr/bin/env bash
JOBS_DIR="${FAKE_JOBS_DIR:?}"
if [[ "${1:-}" == "-c" ]]; then
  job_id="${2:?}"
  if [[ -f "$JOBS_DIR/$job_id.body" ]]; then
    cat "$JOBS_DIR/$job_id.body"
  fi
  exit 0
fi
echo "unsupported fake-at call" >&2
exit 11
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

cat >"$TMP_DIR/fake-fallback.sh" <<'EOF'
#!/usr/bin/env bash
FALLBACK_CALLS="${FAKE_FALLBACK_CALLS:?}"
echo "FALLBACK" >> "$FALLBACK_CALLS"
exit "${FAKE_FALLBACK_EXIT:-0}"
EOF

chmod +x "$TMP_DIR/fake-atq.sh" "$TMP_DIR/fake-at.sh" "$TMP_DIR/fake-atrm.sh" "$TMP_DIR/fake-fallback.sh"

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

run_recover() {
  local output_file="$1"
  local now_epoch="$2"
  set +e
  FAKE_QUEUE_FILE="$QUEUE_FILE" \
  FAKE_CALLS_FILE="$CALLS_FILE" \
  FAKE_JOBS_DIR="$JOBS_DIR" \
  FAKE_FALLBACK_CALLS="$FALLBACK_CALLS" \
  SMA_CLOSEOUT_COOLDOWN_FILE="$COOLDOWN_FILE" \
  SMA_ATQ_CMD="$TMP_DIR/fake-atq.sh" \
  SMA_AT_CAT_CMD="$TMP_DIR/fake-at.sh" \
  SMA_ATRM_CMD="$TMP_DIR/fake-atrm.sh" \
  SMA_CLOSEOUT_FALLBACK_CMD="$TMP_DIR/fake-fallback.sh" \
  SMA_CLOSEOUT_GRACE_SECONDS="120" \
  SMA_CLOSEOUT_NOW_EPOCH="$now_epoch" \
  "$RECOVER_SCRIPT" >"$output_file" 2>&1
  local code=$?
  set -e
  echo "$code"
}

now_epoch="$(date +%s)"
future_epoch="$((now_epoch + 3600))"
future_local="$(date -r "$future_epoch" '+%Y-%m-%d %H:%M:%S %Z')"
past_epoch="$((now_epoch - 600))"
past_local="$(date -r "$past_epoch" '+%Y-%m-%d %H:%M:%S %Z')"

# Case 1: cooldown activo y job en cola -> no recovery
rm -f "$CALLS_FILE" "$FALLBACK_CALLS"
cat >"$COOLDOWN_FILE" <<EOF
not_before_epoch=$future_epoch
not_before_local='$future_local'
reason='api-deployments-free-per-day'
last_error_seen_at='now'
EOF
printf "1\tSCHEDULED\n" > "$QUEUE_FILE"
printf "%s\n" "/path/scripts/closeout-at-job.sh" > "$JOBS_DIR/1.body"
code="$(run_recover "$TMP_DIR/out1.txt" "$now_epoch")"
assert_eq "0" "$code" "cooldown activo no debe recuperar"
if [[ -f "$CALLS_FILE" ]]; then
  assert_not_contains "$CALLS_FILE" "^ATRM" "no debe eliminar jobs en cooldown activo"
fi
if [[ -f "$FALLBACK_CALLS" ]]; then
  assert_not_contains "$FALLBACK_CALLS" "FALLBACK" "no debe lanzar fallback en cooldown activo"
fi

# Case 2: cooldown expirado y sin job -> no recovery
rm -f "$CALLS_FILE" "$FALLBACK_CALLS"
cat >"$COOLDOWN_FILE" <<EOF
not_before_epoch=$past_epoch
not_before_local='$past_local'
reason='api-deployments-free-per-day'
last_error_seen_at='old'
EOF
rm -f "$QUEUE_FILE"
code="$(run_recover "$TMP_DIR/out2.txt" "$now_epoch")"
assert_eq "0" "$code" "sin job activo no debe recuperar"

# Case 3: cooldown expirado + job stale -> recovery
rm -f "$CALLS_FILE" "$FALLBACK_CALLS"
printf "2\tPAST_DUE\n" > "$QUEUE_FILE"
printf "%s\n" "/path/scripts/closeout-at-job.sh" > "$JOBS_DIR/2.body"
code="$(run_recover "$TMP_DIR/out3.txt" "$now_epoch")"
assert_eq "2" "$code" "job stale debe recuperar y devolver 2"
assert_contains "$CALLS_FILE" "^ATRM 2$" "debe eliminar job stale"
assert_contains "$FALLBACK_CALLS" "FALLBACK" "debe ejecutar fallback manual"
assert_contains "$TMP_DIR/out3.txt" "fallback manual" "debe dejar traza de recovery"

# Case 4: fallback falla -> propagar error
rm -f "$CALLS_FILE" "$FALLBACK_CALLS"
printf "3\tPAST_DUE\n" > "$QUEUE_FILE"
printf "%s\n" "/path/scripts/closeout-at-job.sh" > "$JOBS_DIR/3.body"
set +e
FAKE_FALLBACK_EXIT=9 \
FAKE_QUEUE_FILE="$QUEUE_FILE" \
FAKE_CALLS_FILE="$CALLS_FILE" \
FAKE_JOBS_DIR="$JOBS_DIR" \
FAKE_FALLBACK_CALLS="$FALLBACK_CALLS" \
SMA_CLOSEOUT_COOLDOWN_FILE="$COOLDOWN_FILE" \
SMA_ATQ_CMD="$TMP_DIR/fake-atq.sh" \
SMA_AT_CAT_CMD="$TMP_DIR/fake-at.sh" \
SMA_ATRM_CMD="$TMP_DIR/fake-atrm.sh" \
SMA_CLOSEOUT_FALLBACK_CMD="$TMP_DIR/fake-fallback.sh" \
SMA_CLOSEOUT_GRACE_SECONDS="120" \
SMA_CLOSEOUT_NOW_EPOCH="$now_epoch" \
"$RECOVER_SCRIPT" >"$TMP_DIR/out4.txt" 2>&1
code=$?
set -e
assert_eq "9" "$code" "si fallback falla debe propagar exit code"
assert_contains "$CALLS_FILE" "^ATRM 3$" "debe intentar limpiar job stale antes del fallback"

echo "[PASS] recover-past-due-closeout tests"
