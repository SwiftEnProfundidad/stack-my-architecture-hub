#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
READINESS_SCRIPT="$HUB_ROOT/scripts/closeout-readiness.sh"

TMP_DIR="$(mktemp -d)"
RUNTIME_DIR="$TMP_DIR/runtime"
mkdir -p "$RUNTIME_DIR"
STATUS_FILE="$RUNTIME_DIR/auto-closeout-status.env"
COOLDOWN_FILE="$RUNTIME_DIR/vercel-deploy-cooldown.env"
COMPLETE_FLAG="$RUNTIME_DIR/closeout-complete.flag"
FAKE_ATQ="$TMP_DIR/fake-atq.sh"
FAKE_AT="$TMP_DIR/fake-at.sh"
trap 'rm -rf "$TMP_DIR"' EXIT

cat >"$FAKE_ATQ" <<'EOF'
#!/usr/bin/env bash
if [[ "${FAKE_ATQ_MODE:-none}" == "active" ]]; then
  echo "${FAKE_ATQ_LINE:-99 Tue Mar 3 15:50:00 2026}"
fi
EOF

cat >"$FAKE_AT" <<'EOF'
#!/usr/bin/env bash
if [[ "${1:-}" == "-c" ]]; then
  if [[ "${FAKE_ATQ_MODE:-none}" == "active" ]]; then
    echo "/path/scripts/closeout-at-job.sh"
  else
    echo "echo noop"
  fi
fi
EOF

chmod +x "$FAKE_ATQ" "$FAKE_AT"

assert_exit() {
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
  if ! rg -q "$pattern" "$file"; then
    echo "[FAIL] $msg (pattern='$pattern')"
    echo "--- output ---"
    cat "$file"
    exit 1
  fi
}

assert_not_contains() {
  local file="$1"
  local pattern="$2"
  local msg="$3"
  if rg -q "$pattern" "$file"; then
    echo "[FAIL] $msg (pattern='$pattern')"
    echo "--- output ---"
    cat "$file"
    exit 1
  fi
}

run_readiness() {
  local output_file="$1"
  set +e
  SMA_CLOSEOUT_RUNTIME_DIR="$RUNTIME_DIR" \
  SMA_ATQ_CMD="$FAKE_ATQ" \
  SMA_AT_CAT_CMD="$FAKE_AT" \
  "$READINESS_SCRIPT" >"$output_file" 2>&1
  local code=$?
  set -e
  echo "$code"
}

now_epoch="$(date +%s)"
future_epoch="$((now_epoch + 3600))"
future_local="$(date -r "$future_epoch" '+%Y-%m-%d %H:%M:%S %Z')"

# Case 1: sin runtime previo -> EXIT 1
rm -f "$STATUS_FILE" "$COOLDOWN_FILE" "$COMPLETE_FLAG"
export FAKE_ATQ_MODE="none"
code="$(run_readiness "$TMP_DIR/out1.txt")"
assert_exit "1" "$code" "sin ejecución registrada debe devolver 1"
assert_contains "$TMP_DIR/out1.txt" "SIN EJECUCIÓN REGISTRADA" "debe informar falta de ejecución"

# Case 2: cooldown activo sin job -> EXIT 3
cat >"$STATUS_FILE" <<EOF
last_run_at='2026-03-03 00:00:00 CET'
last_log_file='$TMP_DIR/fake-log-1.log'
last_exit_code=2
auto_reschedule='1'
next_retry_epoch=''
next_retry_at=''
next_retry_reason=''
EOF
cat >"$COOLDOWN_FILE" <<EOF
not_before_epoch=$future_epoch
not_before_local='$future_local'
reason='api-deployments-free-per-day'
last_error_seen_at='2026-03-03 00:00:00 CET'
EOF
export FAKE_ATQ_MODE="none"
code="$(run_readiness "$TMP_DIR/out2.txt")"
assert_exit "3" "$code" "cooldown sin job debe devolver 3"
assert_contains "$TMP_DIR/out2.txt" "ATENCIÓN: no hay job de closeout programado" "debe pedir reprogramar job"
assert_contains "$TMP_DIR/out2.txt" "schedule-closeout-at\\.sh --epoch" "debe recomendar reprogramar con epoch dinamico"
assert_contains "$TMP_DIR/out2.txt" "Último log: no disponible" "debe evitar mostrar rutas de log inexistentes"

# Case 3: cooldown activo con job -> EXIT 2
export FAKE_ATQ_MODE="active"
export FAKE_ATQ_LINE="99 Tue Mar 3 15:50:00 2026"
code="$(run_readiness "$TMP_DIR/out3.txt")"
assert_exit "2" "$code" "cooldown con job activo debe devolver 2"
assert_contains "$TMP_DIR/out3.txt" "Job automático activo" "debe mostrar job activo"
assert_contains "$TMP_DIR/out3.txt" "Sugerencia: si el job está más tarde que la ventana" "debe recomendar reprogramación cuando el job va tarde"

# Case 3b: cooldown activo con job alineado -> EXIT 2 sin sugerencia
aligned_epoch="$((future_epoch + 60))"
aligned_line="$(date -r "$aligned_epoch" '+%a %b %e %T %Y')"
export FAKE_ATQ_LINE="98 $aligned_line"
code="$(run_readiness "$TMP_DIR/out3b.txt")"
assert_exit "2" "$code" "cooldown con job alineado debe devolver 2"
assert_contains "$TMP_DIR/out3b.txt" "Job automático activo" "debe mostrar job activo alineado"
assert_not_contains "$TMP_DIR/out3b.txt" "Sugerencia: si el job está más tarde que la ventana" "no debe sugerir reprogramación cuando el job ya está en ventana"

# Case 4: cierre completo -> EXIT 0
cat >"$STATUS_FILE" <<EOF
last_run_at='2026-03-03 15:55:00 CET'
last_log_file='$TMP_DIR/fake-log-success.log'
last_exit_code=0
auto_reschedule='1'
next_retry_epoch=''
next_retry_at=''
next_retry_reason=''
EOF
touch "$COMPLETE_FLAG"
export FAKE_ATQ_MODE="none"
code="$(run_readiness "$TMP_DIR/out4.txt")"
assert_exit "0" "$code" "cierre completo debe devolver 0"
assert_contains "$TMP_DIR/out4.txt" "Estado: LISTO" "debe informar estado listo"

echo "[PASS] closeout-readiness tests"
