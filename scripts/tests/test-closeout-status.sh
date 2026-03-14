#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
STATUS_SCRIPT="$HUB_ROOT/scripts/closeout-status.sh"

TMP_DIR="$(mktemp -d)"
COOLDOWN_FILE="$TMP_DIR/vercel-deploy-cooldown.env"
QUEUE_FILE="$TMP_DIR/queue.txt"
JOBS_DIR="$TMP_DIR/jobs"
mkdir -p "$JOBS_DIR"

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
  FAKE_QUEUE_FILE="$QUEUE_FILE" \
  FAKE_JOBS_DIR="$JOBS_DIR" \
  SMA_CLOSEOUT_COOLDOWN_FILE="$COOLDOWN_FILE" \
  SMA_ATQ_CMD="$TMP_DIR/fake-atq.sh" \
  SMA_AT_CAT_CMD="$TMP_DIR/fake-at.sh" \
  "$STATUS_SCRIPT" >"$output_file" 2>&1
  local code=$?
  set -e
  echo "$code"
}

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

chmod +x "$TMP_DIR/fake-atq.sh" "$TMP_DIR/fake-at.sh"

# Case 1: no cooldown file
rm -f "$COOLDOWN_FILE"
rm -f "$QUEUE_FILE"
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
printf "1\tMAIN\n2\tWATCHDOG\n3\tFOLLOWUP\n" > "$QUEUE_FILE"
printf "%s\n" "/tmp/scripts/closeout-at-job.sh" > "$JOBS_DIR/1.body"
printf "%s\n" "/tmp/scripts/recover-past-due-closeout.sh" > "$JOBS_DIR/2.body"
printf "%s\n" "/tmp/scripts/closeout-window-followup.sh" > "$JOBS_DIR/3.body"
code="$(run_status "$TMP_DIR/out2.txt")"
assert_eq "2" "$code" "active cooldown should return 2"
assert_contains "$TMP_DIR/out2.txt" "Cooldown: activo" "should report active cooldown"
assert_contains "$TMP_DIR/out2.txt" "Motivo: api-deployments-free-per-day" "should report reason"
assert_contains "$TMP_DIR/out2.txt" "Job main activo:" "should report main job"
assert_contains "$TMP_DIR/out2.txt" "Job watchdog activo:" "should report watchdog job"
assert_contains "$TMP_DIR/out2.txt" "Job followup activo:" "should report followup job"

# Case 3: active cooldown with missing window jobs should return attention code
printf "4\tMAIN_ONLY\n" > "$QUEUE_FILE"
printf "%s\n" "/tmp/scripts/closeout-at-job.sh" > "$JOBS_DIR/4.body"
code="$(run_status "$TMP_DIR/out3.txt")"
assert_eq "3" "$code" "active cooldown without full window jobs should return 3"
assert_contains "$TMP_DIR/out3.txt" "ATENCIÓN: faltan jobs de ventana: watchdog followup" "should report missing jobs"

# Case 4: expired cooldown
past_epoch="$(( $(date +%s) - 60 ))"
past_local="$(date -r "$past_epoch" '+%Y-%m-%d %H:%M:%S %Z')"
cat >"$COOLDOWN_FILE" <<EOF
not_before_epoch=$past_epoch
not_before_local='$past_local'
reason='api-deployments-free-per-day'
last_error_seen_at='old'
EOF
code="$(run_status "$TMP_DIR/out4.txt")"
assert_eq "0" "$code" "expired cooldown should return 0"
assert_contains "$TMP_DIR/out4.txt" "Cooldown: expirado" "should report expired cooldown"
assert_contains "$TMP_DIR/out4.txt" "Estado: listo para reintento de deploy" "should report ready state"

echo "[PASS] closeout-status tests"
