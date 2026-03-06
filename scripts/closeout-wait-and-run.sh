#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COOLDOWN_FILE="${SMA_CLOSEOUT_COOLDOWN_FILE:-$HUB_ROOT/.runtime/vercel-deploy-cooldown.env}"
DEPLOY_RUNNER="${SMA_CLOSEOUT_DEPLOY_RUNNER_CMD:-$SCRIPT_DIR/deploy-and-verify-closeout.sh}"

MODE="${1:-fast}"
BASE_URL="${2:-https://architecture-stack.vercel.app}"
POLL_SECONDS="${SMA_CLOSEOUT_POLL_SECONDS:-300}"
MAX_WAIT_SECONDS="${SMA_CLOSEOUT_MAX_WAIT_SECONDS:-64800}"
FORCE_DEPLOY="${SMA_DEPLOY_FORCE:-0}"

usage() {
  echo "Uso: $0 [fast|strict] [base_url]"
  echo "Env opcional:"
  echo "  SMA_CLOSEOUT_POLL_SECONDS=<segundos>"
  echo "  SMA_CLOSEOUT_MAX_WAIT_SECONDS=<segundos>"
  echo "  SMA_DEPLOY_FORCE=1"
}

if [[ "$MODE" != "fast" && "$MODE" != "strict" ]]; then
  usage
  exit 1
fi

if [[ ! "$POLL_SECONDS" =~ ^[0-9]+$ ]] || [[ "$POLL_SECONDS" -le 0 ]]; then
  echo "[WAIT-CLOSEOUT] SMA_CLOSEOUT_POLL_SECONDS invalido: $POLL_SECONDS"
  exit 1
fi

if [[ ! "$MAX_WAIT_SECONDS" =~ ^[0-9]+$ ]] || [[ "$MAX_WAIT_SECONDS" -le 0 ]]; then
  echo "[WAIT-CLOSEOUT] SMA_CLOSEOUT_MAX_WAIT_SECONDS invalido: $MAX_WAIT_SECONDS"
  exit 1
fi

if [[ ! -x "$DEPLOY_RUNNER" ]]; then
  echo "[WAIT-CLOSEOUT] Script no ejecutable o inexistente: $DEPLOY_RUNNER"
  exit 1
fi

if [[ "$FORCE_DEPLOY" == "1" ]]; then
  echo "[WAIT-CLOSEOUT] FORCE activo -> ejecutando deploy inmediato."
  exec "$DEPLOY_RUNNER" "$MODE" "$BASE_URL"
fi

if [[ ! -f "$COOLDOWN_FILE" ]]; then
  echo "[WAIT-CLOSEOUT] Sin cooldown registrado -> ejecutando deploy inmediato."
  exec "$DEPLOY_RUNNER" "$MODE" "$BASE_URL"
fi

# shellcheck disable=SC1090
source "$COOLDOWN_FILE"

not_before_epoch="${not_before_epoch:-0}"
not_before_local="${not_before_local:-desconocido}"
reason="${reason:-desconocido}"
now_epoch="$(date +%s)"

if [[ "$not_before_epoch" -le 0 ]] || [[ "$now_epoch" -ge "$not_before_epoch" ]]; then
  echo "[WAIT-CLOSEOUT] Cooldown expirado/no valido -> ejecutando deploy."
  exec "$DEPLOY_RUNNER" "$MODE" "$BASE_URL"
fi

wait_seconds="$((not_before_epoch - now_epoch))"
if [[ "$wait_seconds" -gt "$MAX_WAIT_SECONDS" ]]; then
  wait_hours="$((wait_seconds / 3600))"
  wait_minutes="$(((wait_seconds % 3600) / 60))"
  echo "[WAIT-CLOSEOUT] Cooldown activo ($reason)."
  echo "[WAIT-CLOSEOUT] Ventana: $not_before_local"
  echo "[WAIT-CLOSEOUT] Espera requerida: ${wait_hours}h ${wait_minutes}m"
  echo "[WAIT-CLOSEOUT] Supera SMA_CLOSEOUT_MAX_WAIT_SECONDS=$MAX_WAIT_SECONDS; saliendo sin intento."
  exit 2
fi

echo "[WAIT-CLOSEOUT] Cooldown activo ($reason). Esperando hasta $not_before_local"
while true; do
  now_epoch="$(date +%s)"
  if [[ "$now_epoch" -ge "$not_before_epoch" ]]; then
    break
  fi
  remaining="$((not_before_epoch - now_epoch))"
  remaining_hours="$((remaining / 3600))"
  remaining_minutes="$(((remaining % 3600) / 60))"
  echo "[WAIT-CLOSEOUT] Restante aprox: ${remaining_hours}h ${remaining_minutes}m"
  sleep_for="$POLL_SECONDS"
  if [[ "$remaining" -lt "$POLL_SECONDS" ]]; then
    sleep_for="$remaining"
  fi
  sleep "$sleep_for"
done

echo "[WAIT-CLOSEOUT] Ventana abierta -> ejecutando deploy + verificacion."
exec "$DEPLOY_RUNNER" "$MODE" "$BASE_URL"
