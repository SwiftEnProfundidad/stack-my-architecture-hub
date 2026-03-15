#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${1:-https://architecture-stack.vercel.app}"
BASE_URL="${BASE_URL%/}"
RUN_TS="$(date -u '+%Y%m%dT%H%M%SZ')"
RUN_TS_READABLE="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
RUN_ID="${SMA_POST_DEPLOY_RUN_ID:-${GITHUB_RUN_ID:-local}}"
RUN_ATTEMPT="${SMA_POST_DEPLOY_RUN_ATTEMPT:-${GITHUB_RUN_ATTEMPT:-1}}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="${SMA_POST_DEPLOY_RUNTIME_DIR:-$HUB_ROOT/.runtime/post-deploy}"
EVIDENCE_FILE="${SMA_POST_DEPLOY_EVIDENCE_FILE:-$RUNTIME_DIR/post-deploy-canary-${RUN_TS}.md}"
STATE_FILE="${SMA_POST_DEPLOY_STATE_FILE:-$RUNTIME_DIR/post-deploy-state.env}"
HISTORY_FILE="${SMA_POST_DEPLOY_HISTORY_FILE:-$RUNTIME_DIR/post-deploy-history.jsonl}"
LOG_DIR="${SMA_POST_DEPLOY_LOG_DIR:-$RUNTIME_DIR/logs}"
CHECKLIST_FILE="${SMA_POST_DEPLOY_CHECKLIST_FILE:-}"
FREEZE_FILE="${SMA_POST_DEPLOY_FREEZE_FILE:-$RUNTIME_DIR/post-deploy-freeze.flag}"
FREEZE_THRESHOLD="${SMA_POST_DEPLOY_FAILURE_THRESHOLD:-2}"

ROUTES_SMOKE="${SMA_POST_DEPLOY_ROUTES_SCRIPT:-$SCRIPT_DIR/smoke-public-routes.sh}"
FUNCTIONAL_SMOKE="${SMA_POST_DEPLOY_FUNCTIONAL_SCRIPT:-$SCRIPT_DIR/smoke-public-functional.sh}"
ROUTES_LOG="$LOG_DIR/routes-${RUN_TS}.log"
FUNCTIONAL_LOG="$LOG_DIR/functional-${RUN_TS}.log"

read_state_value() {
  local key="$1"
  local default="$2"

  local value
  value="$(awk -F= -v key="$key" '$1 == key {print $2; exit}' "$STATE_FILE" 2>/dev/null || true)"

  if [[ -z "${value:-}" ]]; then
    echo "$default"
  else
    echo "$value"
  fi
}

if [[ ! -x "$ROUTES_SMOKE" ]]; then
  echo "[ERROR] Script no ejecutable o inexistente: $ROUTES_SMOKE"
  exit 1
fi

if [[ ! -x "$FUNCTIONAL_SMOKE" ]]; then
  echo "[ERROR] Script no ejecutable o inexistente: $FUNCTIONAL_SMOKE"
  exit 1
fi

mkdir -p "$RUNTIME_DIR"
mkdir -p "$LOG_DIR"

prev_successes="$(read_state_value consecutive_successes 0)"
prev_failures="$(read_state_value consecutive_failures 0)"
freeze_state_before="$(read_state_value freeze_state none)"

if ! [[ "$prev_successes" =~ ^[0-9]+$ ]]; then
  prev_successes=0
fi
if ! [[ "$prev_failures" =~ ^[0-9]+$ ]]; then
  prev_failures=0
fi

echo "[POST-DEPLOY] Iniciando verificación para: $BASE_URL"
echo "[POST-DEPLOY] Paso 1/2: rutas públicas"
set +e
"$ROUTES_SMOKE" "$BASE_URL" 2>&1 | tee "$ROUTES_LOG"
routes_exit=${PIPESTATUS[0]}

echo "[POST-DEPLOY] Paso 2/2: smoke funcional público"
"$FUNCTIONAL_SMOKE" "$BASE_URL" 2>&1 | tee "$FUNCTIONAL_LOG"
functional_exit=${PIPESTATUS[0]}
set -e

if [[ "$routes_exit" -eq 0 ]]; then
  routes_status="ok"
else
  routes_status="failed ($routes_exit)"
fi

if [[ "$functional_exit" -eq 0 ]]; then
  functional_status="ok"
else
  functional_status="failed ($functional_exit)"
fi

overall_exit=0
if [[ "$routes_exit" -ne 0 || "$functional_exit" -ne 0 ]]; then
  overall_exit=1
fi

if [[ "$overall_exit" -eq 0 ]]; then
  consecutive_successes=$((prev_successes + 1))
  consecutive_failures=0
  postdeploy_result="pass"
  freeze_state="resolved"

  if [[ "$freeze_state_before" == "active" && "$consecutive_successes" -lt 2 ]]; then
    freeze_state="warming"
  fi

  if [[ "$freeze_state_before" == "active" && "$consecutive_successes" -ge 2 ]]; then
    freeze_state="cleared"
    rm -f "$FREEZE_FILE"
  fi
else
  consecutive_failures=$((prev_failures + 1))
  consecutive_successes=0
  postdeploy_result="fail"
  freeze_state="$freeze_state_before"

  if (( consecutive_failures >= FREEZE_THRESHOLD )); then
    freeze_state="active"
    mkdir -p "$RUNTIME_DIR"
    {
      echo "postdeploy_freeze='active'"
      echo "postdeploy_run_id='$RUN_ID'"
      echo "postdeploy_run_attempt='$RUN_ATTEMPT'"
      echo "postdeploy_started_at='$RUN_TS_READABLE'"
      echo "postdeploy_base_url='$BASE_URL'"
      echo "postdeploy_failure_streak='$consecutive_failures'"
      echo "postdeploy_threshold='$FREEZE_THRESHOLD'"
      echo "postdeploy_reason='post-deploy canary failed ${consecutive_failures} consecutive checks'"
    } > "$FREEZE_FILE"
  fi
fi

{
  echo "consecutive_successes=$consecutive_successes"
  echo "consecutive_failures=$consecutive_failures"
  echo "postdeploy_result=$postdeploy_result"
  echo "freeze_state=$freeze_state"
  echo "last_run_id=$RUN_ID"
  echo "last_run_attempt=$RUN_ATTEMPT"
  echo "last_base_url=$BASE_URL"
  echo "last_checked_at=$RUN_TS_READABLE"
} > "$STATE_FILE"

mkdir -p "$RUNTIME_DIR"
cat >> "$HISTORY_FILE" <<EOF
{"timestamp":"$RUN_TS_READABLE","run_id":"$RUN_ID","run_attempt":"$RUN_ATTEMPT","base_url":"$BASE_URL","routes_exit":$routes_exit,"functional_exit":$functional_exit,"result":"$postdeploy_result","consecutive_successes":$consecutive_successes,"consecutive_failures":$consecutive_failures,"freeze_state":"$freeze_state"}
EOF

{
  echo "# Post-deploy canary evidence"
  echo "- Fecha UTC: $RUN_TS_READABLE"
  echo "- Run ID: $RUN_ID"
  echo "- Run attempt: $RUN_ATTEMPT"
  echo "- Base URL: $BASE_URL"
  echo "- Resultado previo"
  echo "  - consecutivas verdes previas: $prev_successes"
  echo "  - consecutivas fallos previas: $prev_failures"
  echo "- Resultado actual"
  echo "  - rutas_publicas: $routes_status"
  echo "  - smoke_funcional: $functional_status"
  echo "- Estado de continuidad"
  echo "  - consecutivas verdes: $consecutive_successes"
  echo "  - consecutivas fallos: $consecutive_failures"
  echo "- Estado de freeze"
  echo "  - previo: $freeze_state_before"
  echo "  - actual: $freeze_state"
  if [[ -f "$FREEZE_FILE" ]]; then
    echo "- Freeze activo: sí"
  else
    echo "- Freeze activo: no"
  fi
  echo "- Evidencia de ejecución"
  echo "  - rutas log: $ROUTES_LOG"
  echo "  - funcional log: $FUNCTIONAL_LOG"
  echo "  - estado: $STATE_FILE"
  echo "  - histórico: $HISTORY_FILE"
} > "$EVIDENCE_FILE"

if [[ -n "$CHECKLIST_FILE" ]]; then
  {
    echo "  - post-deploy canary: $postdeploy_result"
    echo "  - post-deploy canary evidencia: $(basename "$EVIDENCE_FILE")"
    echo "  - canary fecha: $RUN_TS_READABLE"
    echo "  - freeze: $freeze_state"
    echo "  - ruta rutas log: $ROUTES_LOG"
    echo "  - ruta funcional log: $FUNCTIONAL_LOG"
  } >> "$CHECKLIST_FILE"
fi

echo "[POST-DEPLOY] Evidencia canary: $EVIDENCE_FILE"
echo "[POST-DEPLOY] Estado: $STATE_FILE"
echo "[POST-DEPLOY] Histórico: $HISTORY_FILE"
echo "[POST-DEPLOY] Freeze: $freeze_state (umbral: $FREEZE_THRESHOLD)"
echo "[POST-DEPLOY] Logs de rutas: $ROUTES_LOG"
echo "[POST-DEPLOY] Logs funcionales: $FUNCTIONAL_LOG"

if [[ "$overall_exit" -eq 0 ]]; then
  echo "[POST-DEPLOY] Verificación completa en verde."
else
  echo "[POST-DEPLOY] Verificación incompleta, revisar evidencia en: $EVIDENCE_FILE"
fi

exit "$overall_exit"
