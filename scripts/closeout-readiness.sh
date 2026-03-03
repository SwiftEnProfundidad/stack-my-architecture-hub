#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="$HUB_ROOT/.runtime"

STATUS_FILE="$RUNTIME_DIR/auto-closeout-status.env"
COOLDOWN_FILE="$RUNTIME_DIR/vercel-deploy-cooldown.env"
COMPLETE_FLAG="$RUNTIME_DIR/closeout-complete.flag"

verbose="${1:-}"
ATQ_CMD="${SMA_ATQ_CMD:-atq}"
AT_CAT_CMD="${SMA_AT_CAT_CMD:-at}"

print_log_tail() {
  local path="$1"
  if [[ -f "$path" ]]; then
    echo "[CLOSEOUT-READINESS] Últimas líneas del log:"
    tail -n 12 "$path"
  fi
}

resolve_log_path() {
  local path="${1:-desconocido}"
  if [[ -z "$path" ]] || [[ "$path" == "desconocido" ]]; then
    echo "desconocido"
    return 0
  fi
  if [[ -f "$path" ]]; then
    echo "$path"
    return 0
  fi
  echo "no disponible"
}

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

extract_atq_minute() {
  local line="$1"
  local time_field
  time_field="$(printf '%s\n' "$line" | awk '{print $5}')"
  if [[ "$time_field" =~ ^[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?$ ]]; then
    awk -F: '{printf "%02d:%02d\n", $1, $2}' <<<"$time_field"
    return 0
  fi
  return 1
}

echo "[CLOSEOUT-READINESS] Hub: $HUB_ROOT"

if [[ -f "$COMPLETE_FLAG" ]] && [[ -f "$STATUS_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$STATUS_FILE"
  if [[ "${last_exit_code:-1}" -eq 0 ]]; then
    resolved_log_path="$(resolve_log_path "${last_log_file:-desconocido}")"
    echo "[CLOSEOUT-READINESS] Estado: LISTO"
    echo "[CLOSEOUT-READINESS] Última ejecución: ${last_run_at:-desconocida}"
    echo "[CLOSEOUT-READINESS] Último log: $resolved_log_path"
    echo "[CLOSEOUT-READINESS] Puedes cerrar 5.3/5.4 en tracking."
    if [[ "$verbose" == "--verbose" ]] && [[ "$resolved_log_path" != "no disponible" ]]; then
      print_log_tail "$resolved_log_path"
    fi
    exit 0
  fi
fi

if [[ -f "$COOLDOWN_FILE" ]]; then
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
    suggested_epoch="$((not_before_epoch + 60))"
    suggested_local="$(date -r "$suggested_epoch" '+%Y-%m-%d %H:%M:%S %Z')"
    echo "[CLOSEOUT-READINESS] Estado: EN ESPERA"
    echo "[CLOSEOUT-READINESS] Motivo: $reason"
    echo "[CLOSEOUT-READINESS] Not before: $not_before_local"
    echo "[CLOSEOUT-READINESS] Restante aprox: ${remaining_hours}h ${remaining_minutes}m"
    if [[ -f "$STATUS_FILE" ]]; then
      # shellcheck disable=SC1090
      source "$STATUS_FILE"
      resolved_log_path="$(resolve_log_path "${last_log_file:-desconocido}")"
      echo "[CLOSEOUT-READINESS] Último exit code job: ${last_exit_code:-desconocido}"
      echo "[CLOSEOUT-READINESS] Último log: $resolved_log_path"
      if [[ "$verbose" == "--verbose" ]] && [[ "$resolved_log_path" != "no disponible" ]]; then
        print_log_tail "$resolved_log_path"
      fi
    fi

    if active_job_line="$(find_active_closeout_job)"; then
      suggested_minute="$(date -r "$suggested_epoch" '+%H:%M')"
      active_job_minute="$(extract_atq_minute "$active_job_line" || true)"
      echo "[CLOSEOUT-READINESS] Job automático activo: $active_job_line"
      if [[ -z "$active_job_minute" ]] || [[ "$active_job_minute" != "$suggested_minute" ]]; then
        echo "[CLOSEOUT-READINESS] Sugerencia: si el job está más tarde que la ventana, reprograma a:"
        echo "[CLOSEOUT-READINESS]   ./scripts/schedule-closeout-at.sh --epoch $suggested_epoch  # $suggested_local"
      fi
      exit 2
    fi

    echo "[CLOSEOUT-READINESS] ATENCIÓN: no hay job de closeout programado."
    echo "[CLOSEOUT-READINESS] Ejecuta: ./scripts/schedule-closeout-at.sh --epoch $suggested_epoch  # $suggested_local"
    exit 3
  fi
fi

if [[ -f "$STATUS_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$STATUS_FILE"
  resolved_log_path="$(resolve_log_path "${last_log_file:-desconocido}")"
  echo "[CLOSEOUT-READINESS] Estado: REVISIÓN MANUAL"
  echo "[CLOSEOUT-READINESS] Última ejecución: ${last_run_at:-desconocida}"
  echo "[CLOSEOUT-READINESS] Exit code: ${last_exit_code:-desconocido}"
  echo "[CLOSEOUT-READINESS] Log: $resolved_log_path"
  echo "[CLOSEOUT-READINESS] Ejecuta: ./scripts/deploy-and-verify-closeout.sh fast"
  if [[ "$verbose" == "--verbose" ]] && [[ "$resolved_log_path" != "no disponible" ]]; then
    print_log_tail "$resolved_log_path"
  fi
  exit 1
fi

echo "[CLOSEOUT-READINESS] Estado: SIN EJECUCIÓN REGISTRADA"
echo "[CLOSEOUT-READINESS] Ejecuta: ./scripts/schedule-closeout-at.sh 15:50"
exit 1
