#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FOLLOWUP_SCRIPT="$HUB_ROOT/scripts/closeout-window-followup.sh"

TMP_DIR="$(mktemp -d)"
RUNTIME_DIR="$TMP_DIR/runtime"
LOG_FILE="$TMP_DIR/followup.log"
AUTO_STATUS="$RUNTIME_DIR/auto-closeout-status.env"
FLAG_FILE="$RUNTIME_DIR/closeout-complete.flag"
mkdir -p "$RUNTIME_DIR"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

cat >"$TMP_DIR/fake-atq.sh" <<'EOF'
#!/usr/bin/env bash
echo "42 Tue Mar 3 16:08:00 2026"
exit 0
EOF

cat >"$TMP_DIR/fake-status.sh" <<'EOF'
#!/usr/bin/env bash
echo "status: cooldown activo"
exit 2
EOF

cat >"$TMP_DIR/fake-readiness.sh" <<'EOF'
#!/usr/bin/env bash
echo "readiness: en espera"
exit 2
EOF

chmod +x "$TMP_DIR/fake-atq.sh" "$TMP_DIR/fake-status.sh" "$TMP_DIR/fake-readiness.sh"

cat >"$AUTO_STATUS" <<'EOF'
last_run_at='2026-03-03 02:07:10 CET'
last_exit_code=3
EOF

touch "$FLAG_FILE"

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

SMA_CLOSEOUT_RUNTIME_DIR="$RUNTIME_DIR" \
SMA_CLOSEOUT_FOLLOWUP_LOG_FILE="$LOG_FILE" \
SMA_ATQ_CMD="$TMP_DIR/fake-atq.sh" \
SMA_CLOSEOUT_STATUS_CMD="$TMP_DIR/fake-status.sh" \
SMA_CLOSEOUT_READINESS_CMD="$TMP_DIR/fake-readiness.sh" \
SMA_CLOSEOUT_AUTO_STATUS_FILE="$AUTO_STATUS" \
SMA_CLOSEOUT_COMPLETE_FLAG="$FLAG_FILE" \
"$FOLLOWUP_SCRIPT" >"$TMP_DIR/stdout.txt" 2>&1

assert_contains "$TMP_DIR/stdout.txt" "\\[FOLLOWUP\\] Log:" "debe imprimir path de log"
assert_contains "$LOG_FILE" "\\[FOLLOWUP\\] >>> atq" "debe ejecutar atq"
assert_contains "$LOG_FILE" "42 Tue Mar 3 16:08:00 2026" "debe volcar salida de atq"
assert_contains "$LOG_FILE" "closeout-status exit=2" "debe registrar exit code de status"
assert_contains "$LOG_FILE" "status: cooldown activo" "debe incluir salida de status"
assert_contains "$LOG_FILE" "closeout-readiness exit=2" "debe registrar exit code de readiness"
assert_contains "$LOG_FILE" "readiness: en espera" "debe incluir salida de readiness"
assert_contains "$LOG_FILE" "auto-closeout-status\\.env" "debe incluir bloque de status file"
assert_contains "$LOG_FILE" "last_exit_code=3" "debe incluir contenido de status file"
assert_contains "$LOG_FILE" "closeout-complete\\.flag present" "debe indicar flag presente"

echo "[PASS] closeout-window-followup tests"
