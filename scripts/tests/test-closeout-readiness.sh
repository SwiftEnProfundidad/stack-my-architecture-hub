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
case "${FAKE_ATQ_MODE:-none}" in
  active)
    echo "${FAKE_ATQ_LINE:-99 Tue Mar 3 15:50:00 2026}"
    ;;
  window-complete)
    if [[ -n "${FAKE_ATQ_LINES:-}" ]]; then
      printf '%s\n' "$FAKE_ATQ_LINES"
    else
      cat <<JOBS
201 Tue Mar 3 15:50:00 2026
202 Tue Mar 3 15:52:00 2026
203 Tue Mar 3 15:54:00 2026
JOBS
    fi
    ;;
  window-missing-followup)
    if [[ -n "${FAKE_ATQ_LINES:-}" ]]; then
      printf '%s\n' "$FAKE_ATQ_LINES"
    else
      cat <<JOBS
201 Tue Mar 3 15:50:00 2026
202 Tue Mar 3 15:52:00 2026
JOBS
    fi
    ;;
esac
EOF

cat >"$FAKE_AT" <<'EOF'
#!/usr/bin/env bash
if [[ "${1:-}" == "-c" ]]; then
  job_id="${2:-0}"
  case "${FAKE_ATQ_MODE:-none}" in
    active)
      echo "/path/scripts/closeout-at-job.sh"
      ;;
    window-complete)
      case "$job_id" in
        201) echo "/path/scripts/closeout-at-job.sh" ;;
        202) echo "/path/scripts/recover-past-due-closeout.sh" ;;
        203) echo "/path/scripts/closeout-window-followup.sh" ;;
        *) echo "echo noop" ;;
      esac
      ;;
    window-missing-followup)
      case "$job_id" in
        201) echo "/path/scripts/closeout-at-job.sh" ;;
        202) echo "/path/scripts/recover-past-due-closeout.sh" ;;
        *) echo "echo noop" ;;
      esac
      ;;
    *)
      echo "echo noop"
      ;;
  esac
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
assert_contains "$TMP_DIR/out2.txt" "ATENCIÓN: faltan jobs de ventana: main watchdog followup" "debe alertar ventana incompleta"
assert_contains "$TMP_DIR/out2.txt" "schedule-closeout-window\\.sh" "debe recomendar reprogramar ventana completa"
assert_contains "$TMP_DIR/out2.txt" "Último log: no disponible" "debe evitar mostrar rutas de log inexistentes"

# Case 3: cooldown activo con solo job main -> EXIT 3 (faltan watchdog/followup)
export FAKE_ATQ_MODE="active"
export FAKE_ATQ_LINE="99 Tue Mar 3 15:50:00 2026"
code="$(run_readiness "$TMP_DIR/out3.txt")"
assert_exit "3" "$code" "cooldown con solo main debe devolver 3"
assert_contains "$TMP_DIR/out3.txt" "ATENCIÓN: faltan jobs de ventana: watchdog followup" "debe alertar faltantes de ventana"
assert_contains "$TMP_DIR/out3.txt" "schedule-closeout-window\\.sh" "debe recomendar orquestador de ventana"

# Case 3b: cooldown con ventana completa y main tarde -> EXIT 2 con sugerencia
unset FAKE_ATQ_LINES
export FAKE_ATQ_MODE="window-complete"
code="$(run_readiness "$TMP_DIR/out3b.txt")"
assert_exit "2" "$code" "cooldown con ventana completa debe devolver 2"
assert_contains "$TMP_DIR/out3b.txt" "Job main activo" "debe mostrar job main"
assert_contains "$TMP_DIR/out3b.txt" "Job watchdog activo" "debe mostrar job watchdog"
assert_contains "$TMP_DIR/out3b.txt" "Job followup activo" "debe mostrar job followup"
assert_contains "$TMP_DIR/out3b.txt" "Sugerencia: si el job está más tarde que la ventana" "debe sugerir reprogramación cuando main va tarde"
assert_not_contains "$TMP_DIR/out3b.txt" "ATENCIÓN: faltan jobs de ventana" "no debe alertar faltantes con ventana completa"

# Case 3c: cooldown con ventana completa y main alineado -> EXIT 2 sin sugerencia
aligned_epoch="$((future_epoch + 60))"
aligned_line="$(date -r "$aligned_epoch" '+%a %b %e %T %Y')"
export FAKE_ATQ_LINES="$(cat <<JOBS
201 $aligned_line
202 Tue Mar 3 15:52:00 2026
203 Tue Mar 3 15:54:00 2026
JOBS
)"
code="$(run_readiness "$TMP_DIR/out3c.txt")"
assert_exit "2" "$code" "cooldown con ventana completa y main alineado debe devolver 2"
assert_contains "$TMP_DIR/out3c.txt" "Job main activo" "debe mostrar job main alineado"
assert_not_contains "$TMP_DIR/out3c.txt" "Sugerencia: si el job está más tarde que la ventana" "no debe sugerir reprogramación cuando el main ya está en ventana"

# Case 3d: cooldown con ventana incompleta -> EXIT 3 y sugerencia window scheduler
export FAKE_ATQ_MODE="window-missing-followup"
unset FAKE_ATQ_LINES
code="$(run_readiness "$TMP_DIR/out3d.txt")"
assert_exit "3" "$code" "cooldown con ventana incompleta debe devolver 3"
assert_contains "$TMP_DIR/out3d.txt" "ATENCIÓN: faltan jobs de ventana: followup" "debe alertar job faltante"
assert_contains "$TMP_DIR/out3d.txt" "schedule-closeout-window\\.sh" "debe recomendar reprogramar la ventana completa"

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
