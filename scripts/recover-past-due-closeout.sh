#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

COOLDOWN_FILE="${SMA_CLOSEOUT_COOLDOWN_FILE:-$HUB_ROOT/.runtime/vercel-deploy-cooldown.env}"
ATQ_CMD="${SMA_ATQ_CMD:-atq}"
AT_CAT_CMD="${SMA_AT_CAT_CMD:-at}"
ATRM_CMD="${SMA_ATRM_CMD:-atrm}"
FALLBACK_CMD="${SMA_CLOSEOUT_FALLBACK_CMD:-$SCRIPT_DIR/closeout-at-job.sh}"
GRACE_SECONDS="${SMA_CLOSEOUT_GRACE_SECONDS:-180}"
NOW_EPOCH_OVERRIDE="${SMA_CLOSEOUT_NOW_EPOCH:-}"

if [[ ! "$GRACE_SECONDS" =~ ^[0-9]+$ ]]; then
  echo "[RECOVER-CLOSEOUT] SMA_CLOSEOUT_GRACE_SECONDS inválido: $GRACE_SECONDS"
  exit 1
fi

if [[ ! -x "$FALLBACK_CMD" ]]; then
  echo "[RECOVER-CLOSEOUT] Fallback no ejecutable: $FALLBACK_CMD"
  exit 1
fi

find_active_closeout_job() {
  local jobs line job_id job_body
  jobs="$("$ATQ_CMD" 2>/dev/null || true)"
  [[ -z "$jobs" ]] && return 1

  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    job_id="$(printf '%s\n' "$line" | awk '{print $1}')"
    job_body="$("$AT_CAT_CMD" -c "$job_id" 2>/dev/null || true)"
    if printf '%s\n' "$job_body" | rg -q "scripts/closeout-at-job\\.sh|closeout-at-job\\.sh"; then
      printf '%s\n' "$line"
      return 0
    fi
  done <<<"$jobs"

  return 1
}

echo "[RECOVER-CLOSEOUT] Hub: $HUB_ROOT"

if [[ ! -f "$COOLDOWN_FILE" ]]; then
  echo "[RECOVER-CLOSEOUT] Sin cooldown activo: no recovery."
  exit 0
fi

# shellcheck disable=SC1090
source "$COOLDOWN_FILE"
not_before_epoch="${not_before_epoch:-0}"
not_before_local="${not_before_local:-desconocido}"

if [[ -n "$NOW_EPOCH_OVERRIDE" ]]; then
  now_epoch="$NOW_EPOCH_OVERRIDE"
else
  now_epoch="$(date +%s)"
fi

if [[ ! "$now_epoch" =~ ^[0-9]+$ ]]; then
  echo "[RECOVER-CLOSEOUT] SMA_CLOSEOUT_NOW_EPOCH inválido: $now_epoch"
  exit 1
fi

if [[ ! "$not_before_epoch" =~ ^[0-9]+$ ]] || [[ "$not_before_epoch" -le 0 ]]; then
  echo "[RECOVER-CLOSEOUT] Cooldown sin not_before válido: no recovery."
  exit 0
fi

recover_threshold="$((not_before_epoch + GRACE_SECONDS))"
if [[ "$now_epoch" -lt "$recover_threshold" ]]; then
  echo "[RECOVER-CLOSEOUT] Aún dentro de ventana/gracia."
  echo "[RECOVER-CLOSEOUT] Not before: $not_before_local"
  exit 0
fi

if ! active_job_line="$(find_active_closeout_job)"; then
  echo "[RECOVER-CLOSEOUT] Sin job closeout activo: no recovery."
  exit 0
fi

stale_job_id="$(printf '%s\n' "$active_job_line" | awk '{print $1}')"
echo "[RECOVER-CLOSEOUT] Detectado job stale: $active_job_line"
echo "[RECOVER-CLOSEOUT] Eliminando job stale: $stale_job_id"
"$ATRM_CMD" "$stale_job_id"

echo "[RECOVER-CLOSEOUT] Ejecutando fallback manual: $FALLBACK_CMD"
set +e
"$FALLBACK_CMD"
fallback_code=$?
set -e

if [[ "$fallback_code" -eq 0 ]]; then
  echo "[RECOVER-CLOSEOUT] Recovery completado (fallback manual OK)."
  exit 2
fi

echo "[RECOVER-CLOSEOUT] Fallback manual falló (exit=$fallback_code)."
exit "$fallback_code"
