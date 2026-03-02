#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="${SMA_CLOSEOUT_RUNTIME_DIR:-$HUB_ROOT/.runtime}"
COOLDOWN_FILE="${SMA_CLOSEOUT_COOLDOWN_FILE:-$RUNTIME_DIR/vercel-deploy-cooldown.env}"

MODE="${1:-fast}"
BASE_URL="${2:-https://architecture-stack.vercel.app}"
FORCE_DEPLOY="${SMA_DEPLOY_FORCE:-0}"

if [[ "$MODE" != "fast" && "$MODE" != "strict" ]]; then
  echo "Uso: $0 [fast|strict] [base_url]"
  exit 1
fi

PUBLISH_SCRIPT="${SMA_CLOSEOUT_PUBLISH_SCRIPT:-$SCRIPT_DIR/publish-architecture-stack.sh}"
POST_DEPLOY_CHECKS="${SMA_CLOSEOUT_POSTCHECKS_SCRIPT:-$SCRIPT_DIR/post-deploy-checks.sh}"

if [[ ! -x "$PUBLISH_SCRIPT" ]]; then
  echo "[ERROR] Script no ejecutable o inexistente: $PUBLISH_SCRIPT"
  exit 1
fi

if [[ ! -x "$POST_DEPLOY_CHECKS" ]]; then
  echo "[ERROR] Script no ejecutable o inexistente: $POST_DEPLOY_CHECKS"
  exit 1
fi

mkdir -p "$RUNTIME_DIR"

load_cooldown() {
  if [[ ! -f "$COOLDOWN_FILE" ]]; then
    return 1
  fi
  # shellcheck disable=SC1090
  source "$COOLDOWN_FILE"
  return 0
}

if [[ "$FORCE_DEPLOY" != "1" ]] && load_cooldown; then
  now_epoch="$(date +%s)"
  if [[ -n "${not_before_epoch:-}" ]] && [[ "$now_epoch" -lt "$not_before_epoch" ]]; then
    remaining="$((not_before_epoch - now_epoch))"
    remaining_hours="$((remaining / 3600))"
    remaining_minutes="$(((remaining % 3600) / 60))"
    echo "[GUARD] Despliegue bloqueado por cooldown de cuota."
    echo "[GUARD] Motivo: ${reason:-api-deployments-free-per-day}"
    echo "[GUARD] Reintentar no antes de: ${not_before_local:-desconocido}"
    echo "[GUARD] Tiempo restante aproximado: ${remaining_hours}h ${remaining_minutes}m"
    echo "[GUARD] Si necesitas forzar el intento: SMA_DEPLOY_FORCE=1 $0 $MODE $BASE_URL"
    exit 2
  fi
fi

deploy_log="$(mktemp)"

echo "[CLOSEOUT] Paso 1/2: deploy productivo (mode=$MODE)"
set +e
"$PUBLISH_SCRIPT" "$MODE" 2>&1 | tee "$deploy_log"
deploy_status=${PIPESTATUS[0]}
set -e

if [[ "$deploy_status" -ne 0 ]]; then
  if grep -q "api-deployments-free-per-day" "$deploy_log"; then
    retry_hours="$(grep -Eo 'try again in [0-9]+ hours' "$deploy_log" | grep -Eo '[0-9]+' | head -1 || true)"
    if [[ -z "$retry_hours" ]]; then
      retry_hours=16
    fi
    now_epoch="$(date +%s)"
    not_before_epoch="$((now_epoch + retry_hours * 3600))"
    not_before_local="$(date -r "$not_before_epoch" '+%Y-%m-%d %H:%M:%S %Z')"
    last_error_seen_at="$(date '+%Y-%m-%d %H:%M:%S %Z')"

    {
      echo "not_before_epoch=$not_before_epoch"
      echo "not_before_local='$not_before_local'"
      echo "reason='api-deployments-free-per-day'"
      echo "last_error_seen_at='$last_error_seen_at'"
    } >"$COOLDOWN_FILE"

    echo "[GUARD] Cuota detectada. Cooldown registrado en: $COOLDOWN_FILE"
    echo "[GUARD] Próxima ventana estimada: $not_before_local"
    rm -f "$deploy_log"
    exit 3
  fi

  rm -f "$deploy_log"
  exit "$deploy_status"
fi

rm -f "$deploy_log"
rm -f "$COOLDOWN_FILE"

echo "[CLOSEOUT] Paso 2/2: verificación post-deploy"
"$POST_DEPLOY_CHECKS" "$BASE_URL"

echo "[CLOSEOUT] Deploy + verificación final completados en verde."
