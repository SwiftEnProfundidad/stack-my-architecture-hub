#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COOLDOWN_FILE="${SMA_CLOSEOUT_COOLDOWN_FILE:-$HUB_ROOT/.runtime/vercel-deploy-cooldown.env}"

echo "[CLOSEOUT-STATUS] Hub: $HUB_ROOT"

if [[ ! -f "$COOLDOWN_FILE" ]]; then
  echo "[CLOSEOUT-STATUS] Cooldown: no registrado"
  echo "[CLOSEOUT-STATUS] Estado: listo para intentar deploy"
  echo "[CLOSEOUT-STATUS] Comando:"
  echo "  ./scripts/deploy-and-verify-closeout.sh fast"
  exit 0
fi

# shellcheck disable=SC1090
source "$COOLDOWN_FILE"

now_epoch="$(date +%s)"
not_before_epoch="${not_before_epoch:-0}"
not_before_local="${not_before_local:-desconocido}"
reason="${reason:-desconocido}"

if [[ "$now_epoch" -lt "$not_before_epoch" ]]; then
  remaining="$((not_before_epoch - now_epoch))"
  remaining_hours="$((remaining / 3600))"
  remaining_minutes="$(((remaining % 3600) / 60))"
  echo "[CLOSEOUT-STATUS] Cooldown: activo"
  echo "[CLOSEOUT-STATUS] Motivo: $reason"
  echo "[CLOSEOUT-STATUS] Not before: $not_before_local"
  echo "[CLOSEOUT-STATUS] Restante aprox: ${remaining_hours}h ${remaining_minutes}m"
  echo "[CLOSEOUT-STATUS] Comando recomendado cuando abra ventana:"
  echo "  ./scripts/deploy-and-verify-closeout.sh fast"
  exit 2
fi

echo "[CLOSEOUT-STATUS] Cooldown: expirado"
echo "[CLOSEOUT-STATUS] Motivo previo: $reason"
echo "[CLOSEOUT-STATUS] Not before: $not_before_local"
echo "[CLOSEOUT-STATUS] Estado: listo para reintento de deploy"
echo "[CLOSEOUT-STATUS] Comando:"
echo "  ./scripts/deploy-and-verify-closeout.sh fast"
