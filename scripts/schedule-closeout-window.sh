#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

COOLDOWN_FILE="${SMA_CLOSEOUT_COOLDOWN_FILE:-$HUB_ROOT/.runtime/vercel-deploy-cooldown.env}"
SCHEDULER_CMD="${SMA_CLOSEOUT_SCHEDULER_CMD:-$SCRIPT_DIR/schedule-closeout-at.sh}"
RECOVER_SCRIPT="${SMA_CLOSEOUT_RECOVER_SCRIPT:-$SCRIPT_DIR/recover-past-due-closeout.sh}"
ATQ_CMD="${SMA_ATQ_CMD:-atq}"
AT_CMD="${SMA_AT_CMD:-at}"
ATRM_CMD="${SMA_ATRM_CMD:-atrm}"
AT_FORCE_SANITIZE="${SMA_AT_FORCE_SANITIZE:-0}"

MAIN_OFFSET_SECONDS="${SMA_CLOSEOUT_MAIN_OFFSET_SECONDS:-60}"
WATCHDOG_DELAY_SECONDS="${SMA_CLOSEOUT_WATCHDOG_DELAY_SECONDS:-120}"

base_epoch_arg=""
SANITIZED_ENV=()

usage() {
  cat <<'EOF'
Uso:
  ./scripts/schedule-closeout-window.sh [--epoch <unix_epoch>]

Descripción:
  Programa en una sola operación:
  1) job principal de closeout (closeout-at-job.sh) en not_before+MAIN_OFFSET
  2) watchdog de recovery (recover-past-due-closeout.sh) en main_epoch+WATCHDOG_DELAY

Env opcional:
  SMA_CLOSEOUT_COOLDOWN_FILE
  SMA_CLOSEOUT_SCHEDULER_CMD
  SMA_CLOSEOUT_RECOVER_SCRIPT
  SMA_CLOSEOUT_MAIN_OFFSET_SECONDS   (default: 60)
  SMA_CLOSEOUT_WATCHDOG_DELAY_SECONDS (default: 120)
  SMA_ATQ_CMD / SMA_AT_CMD / SMA_ATRM_CMD
  SMA_AT_FORCE_SANITIZE=1
EOF
}

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" == "--epoch" ]]; then
  base_epoch_arg="${2:-}"
  if [[ -z "$base_epoch_arg" ]] || [[ ! "$base_epoch_arg" =~ ^[0-9]+$ ]]; then
    echo "[SCHEDULE-WINDOW] --epoch requiere segundos unix válidos."
    exit 1
  fi
fi

if [[ ! "$MAIN_OFFSET_SECONDS" =~ ^[0-9]+$ ]]; then
  echo "[SCHEDULE-WINDOW] SMA_CLOSEOUT_MAIN_OFFSET_SECONDS inválido: $MAIN_OFFSET_SECONDS"
  exit 1
fi

if [[ ! "$WATCHDOG_DELAY_SECONDS" =~ ^[0-9]+$ ]]; then
  echo "[SCHEDULE-WINDOW] SMA_CLOSEOUT_WATCHDOG_DELAY_SECONDS inválido: $WATCHDOG_DELAY_SECONDS"
  exit 1
fi

if [[ ! -x "$SCHEDULER_CMD" ]]; then
  echo "[SCHEDULE-WINDOW] Scheduler no ejecutable: $SCHEDULER_CMD"
  exit 1
fi

if [[ ! -x "$RECOVER_SCRIPT" ]]; then
  echo "[SCHEDULE-WINDOW] Recovery no ejecutable: $RECOVER_SCRIPT"
  exit 1
fi

should_sanitize_at_env() {
  local system_at
  system_at="$(command -v at 2>/dev/null || true)"

  if [[ "$AT_FORCE_SANITIZE" == "1" ]]; then
    return 0
  fi

  if [[ "$AT_CMD" == "at" ]]; then
    return 0
  fi

  if [[ -n "$system_at" ]] && [[ "$AT_CMD" == "$system_at" ]]; then
    return 0
  fi

  return 1
}

build_sanitized_env() {
  SANITIZED_ENV=(
    "HOME=${HOME:-}"
    "PATH=${PATH:-/usr/bin:/bin:/usr/sbin:/sbin}"
    "SHELL=${SHELL:-/bin/sh}"
    "LANG=${LANG:-C.UTF-8}"
    "LC_ALL=${LC_ALL:-C.UTF-8}"
    "LC_CTYPE=${LC_CTYPE:-C.UTF-8}"
  )

  while IFS='=' read -r key _; do
    if [[ "$key" == FAKE_* ]]; then
      SANITIZED_ENV+=("$key=${!key}")
    fi
  done < <(env)
}

run_at_cmd() {
  if should_sanitize_at_env; then
    build_sanitized_env
    env -i "${SANITIZED_ENV[@]}" "$AT_CMD" "$@"
  else
    "$AT_CMD" "$@"
  fi
}

remove_old_watchdog_jobs() {
  local jobs line job_id job_body
  jobs="$("$ATQ_CMD" 2>/dev/null || true)"
  [[ -z "$jobs" ]] && return 0

  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    job_id="$(printf '%s\n' "$line" | awk '{print $1}')"
    job_body="$(run_at_cmd -c "$job_id" 2>/dev/null || true)"
    if printf '%s\n' "$job_body" | rg -q "recover-past-due-closeout\\.sh|scripts/recover-past-due-closeout\\.sh"; then
      "$ATRM_CMD" "$job_id"
      echo "[SCHEDULE-WINDOW] Removed old recovery watchdog job: $job_id"
    fi
  done <<<"$jobs"
}

if [[ -n "$base_epoch_arg" ]]; then
  base_epoch="$base_epoch_arg"
  base_local="$(date -r "$base_epoch" '+%Y-%m-%d %H:%M:%S %Z')"
else
  if [[ ! -f "$COOLDOWN_FILE" ]]; then
    echo "[SCHEDULE-WINDOW] No se encontró cooldown file: $COOLDOWN_FILE"
    echo "[SCHEDULE-WINDOW] Usa --epoch <unix_epoch> o genera cooldown con un intento previo."
    exit 1
  fi

  # shellcheck disable=SC1090
  source "$COOLDOWN_FILE"
  base_epoch="${not_before_epoch:-0}"
  base_local="${not_before_local:-desconocido}"
  if [[ ! "$base_epoch" =~ ^[0-9]+$ ]] || [[ "$base_epoch" -le 0 ]]; then
    echo "[SCHEDULE-WINDOW] Cooldown sin not_before_epoch válido."
    exit 1
  fi
fi

main_epoch="$((base_epoch + MAIN_OFFSET_SECONDS))"
watchdog_epoch="$((main_epoch + WATCHDOG_DELAY_SECONDS))"
main_local="$(date -r "$main_epoch" '+%Y-%m-%d %H:%M:%S %Z')"
watchdog_local="$(date -r "$watchdog_epoch" '+%Y-%m-%d %H:%M:%S %Z')"

echo "[SCHEDULE-WINDOW] Base window: $base_local ($base_epoch)"
echo "[SCHEDULE-WINDOW] Main closeout: $main_local ($main_epoch)"
echo "[SCHEDULE-WINDOW] Watchdog: $watchdog_local ($watchdog_epoch)"

"$SCHEDULER_CMD" --epoch "$main_epoch"

remove_old_watchdog_jobs

{
  printf '%s\n' "$RECOVER_SCRIPT"
} | run_at_cmd -t "$(date -r "$watchdog_epoch" '+%Y%m%d%H%M.%S')"

echo "[SCHEDULE-WINDOW] Scheduled recovery watchdog at epoch: $watchdog_epoch ($watchdog_local)"
echo "[SCHEDULE-WINDOW] Current queue:"
"$ATQ_CMD" || true
