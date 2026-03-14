#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COOLDOWN_FILE="${SMA_CLOSEOUT_COOLDOWN_FILE:-$HUB_ROOT/.runtime/vercel-deploy-cooldown.env}"
ATQ_CMD="${SMA_ATQ_CMD:-atq}"
AT_CAT_CMD="${SMA_AT_CAT_CMD:-at}"

echo "[CLOSEOUT-STATUS] Hub: $HUB_ROOT"

find_job_line_by_pattern() {
  local pattern="$1"
  local jobs line job_id job_body
  jobs="$("$ATQ_CMD" 2>/dev/null || true)"
  [[ -z "$jobs" ]] && return 1

  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    job_id="$(printf '%s\n' "$line" | awk '{print $1}')"
    job_body="$("$AT_CAT_CMD" -c "$job_id" 2>/dev/null || true)"
    if printf '%s\n' "$job_body" | rg -q "$pattern"; then
      printf '%s\n' "$line"
      return 0
    fi
  done <<<"$jobs"

  return 1
}

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
  missing_jobs=()

  main_job_line="$(find_job_line_by_pattern "scripts/closeout-at-job\\.sh|closeout-at-job\\.sh" || true)"
  watchdog_job_line="$(find_job_line_by_pattern "recover-past-due-closeout\\.sh|scripts/recover-past-due-closeout\\.sh" || true)"
  followup_job_line="$(find_job_line_by_pattern "closeout-window-followup\\.sh|scripts/closeout-window-followup\\.sh" || true)"

  if [[ -z "$main_job_line" ]]; then
    missing_jobs+=("main")
  fi
  if [[ -z "$watchdog_job_line" ]]; then
    missing_jobs+=("watchdog")
  fi
  if [[ -z "$followup_job_line" ]]; then
    missing_jobs+=("followup")
  fi

  echo "[CLOSEOUT-STATUS] Cooldown: activo"
  echo "[CLOSEOUT-STATUS] Motivo: $reason"
  echo "[CLOSEOUT-STATUS] Not before: $not_before_local"
  echo "[CLOSEOUT-STATUS] Restante aprox: ${remaining_hours}h ${remaining_minutes}m"

  if [[ -n "$main_job_line" ]]; then
    echo "[CLOSEOUT-STATUS] Job main activo: $main_job_line"
  fi
  if [[ -n "$watchdog_job_line" ]]; then
    echo "[CLOSEOUT-STATUS] Job watchdog activo: $watchdog_job_line"
  fi
  if [[ -n "$followup_job_line" ]]; then
    echo "[CLOSEOUT-STATUS] Job followup activo: $followup_job_line"
  fi

  if [[ "${#missing_jobs[@]}" -gt 0 ]]; then
    echo "[CLOSEOUT-STATUS] ATENCIÓN: faltan jobs de ventana: ${missing_jobs[*]}"
    echo "[CLOSEOUT-STATUS] Reprograma ventana con:"
    echo "  ./scripts/schedule-closeout-window.sh"
    exit 3
  fi

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
