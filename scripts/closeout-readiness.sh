#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="$HUB_ROOT/.runtime"

STATUS_FILE="$RUNTIME_DIR/auto-closeout-status.env"
COOLDOWN_FILE="$RUNTIME_DIR/vercel-deploy-cooldown.env"
COMPLETE_FLAG="$RUNTIME_DIR/closeout-complete.flag"

verbose="${1:-}"

print_log_tail() {
  local path="$1"
  if [[ -f "$path" ]]; then
    echo "[CLOSEOUT-READINESS] Últimas líneas del log:"
    tail -n 12 "$path"
  fi
}

echo "[CLOSEOUT-READINESS] Hub: $HUB_ROOT"

if [[ -f "$COMPLETE_FLAG" ]] && [[ -f "$STATUS_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$STATUS_FILE"
  if [[ "${last_exit_code:-1}" -eq 0 ]]; then
    echo "[CLOSEOUT-READINESS] Estado: LISTO"
    echo "[CLOSEOUT-READINESS] Última ejecución: ${last_run_at:-desconocida}"
    echo "[CLOSEOUT-READINESS] Último log: ${last_log_file:-desconocido}"
    echo "[CLOSEOUT-READINESS] Puedes cerrar 5.3/5.4 en tracking."
    if [[ "$verbose" == "--verbose" ]]; then
      print_log_tail "${last_log_file:-}"
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
    echo "[CLOSEOUT-READINESS] Estado: EN ESPERA"
    echo "[CLOSEOUT-READINESS] Motivo: $reason"
    echo "[CLOSEOUT-READINESS] Not before: $not_before_local"
    echo "[CLOSEOUT-READINESS] Restante aprox: ${remaining_hours}h ${remaining_minutes}m"
    if [[ -f "$STATUS_FILE" ]]; then
      # shellcheck disable=SC1090
      source "$STATUS_FILE"
      echo "[CLOSEOUT-READINESS] Último exit code job: ${last_exit_code:-desconocido}"
      echo "[CLOSEOUT-READINESS] Último log: ${last_log_file:-desconocido}"
      if [[ "$verbose" == "--verbose" ]]; then
        print_log_tail "${last_log_file:-}"
      fi
    fi
    exit 2
  fi
fi

if [[ -f "$STATUS_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$STATUS_FILE"
  echo "[CLOSEOUT-READINESS] Estado: REVISIÓN MANUAL"
  echo "[CLOSEOUT-READINESS] Última ejecución: ${last_run_at:-desconocida}"
  echo "[CLOSEOUT-READINESS] Exit code: ${last_exit_code:-desconocido}"
  echo "[CLOSEOUT-READINESS] Log: ${last_log_file:-desconocido}"
  echo "[CLOSEOUT-READINESS] Ejecuta: ./scripts/deploy-and-verify-closeout.sh fast"
  if [[ "$verbose" == "--verbose" ]]; then
    print_log_tail "${last_log_file:-}"
  fi
  exit 1
fi

echo "[CLOSEOUT-READINESS] Estado: SIN EJECUCIÓN REGISTRADA"
echo "[CLOSEOUT-READINESS] Ejecuta: ./scripts/schedule-closeout-at.sh 15:50"
exit 1
