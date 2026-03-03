#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="$HUB_ROOT/.runtime"
ATQ_CMD="${SMA_ATQ_CMD:-atq}"
AT_CMD="${SMA_AT_CMD:-at}"
ATRM_CMD="${SMA_ATRM_CMD:-atrm}"
AT_FORCE_SANITIZE="${SMA_AT_FORCE_SANITIZE:-0}"

when="${1:-15:50}"
epoch_arg=""
job_script="$SCRIPT_DIR/closeout-at-job.sh"
SANITIZED_ENV=()

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

if [[ "${1:-}" == "--epoch" ]]; then
  epoch_arg="${2:-}"
  if [[ -z "$epoch_arg" ]] || [[ ! "$epoch_arg" =~ ^[0-9]+$ ]]; then
    echo "[SCHEDULE-CLOSEOUT] --epoch requiere segundos unix validos."
    exit 1
  fi
fi

if [[ ! -x "$job_script" ]]; then
  echo "[SCHEDULE-CLOSEOUT] Script no ejecutable: $job_script"
  exit 1
fi

mkdir -p "$RUNTIME_DIR"

jobs="$("$ATQ_CMD" 2>/dev/null || true)"
if [[ -n "$jobs" ]]; then
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    job_id="$(printf '%s\n' "$line" | awk '{print $1}')"
    job_body="$(run_at_cmd -c "$job_id" 2>/dev/null || true)"
    if printf '%s\n' "$job_body" | rg -q "closeout-at-job.sh|closeout-at-job\\.sh|closeout-wait-and-run.sh|closeout-at-job"; then
      "$ATRM_CMD" "$job_id"
      echo "[SCHEDULE-CLOSEOUT] Removed old closeout job: $job_id"
    fi
  done <<<"$jobs"
fi

{
  printf '%s\n' "$job_script"
} | if [[ -n "$epoch_arg" ]]; then
  run_at_cmd -t "$(date -r "$epoch_arg" '+%Y%m%d%H%M.%S')"
else
  run_at_cmd "$when"
fi

if [[ -n "$epoch_arg" ]]; then
  echo "[SCHEDULE-CLOSEOUT] Scheduled closeout job at epoch: $epoch_arg ($(date -r "$epoch_arg" '+%Y-%m-%d %H:%M:%S %Z'))"
else
  echo "[SCHEDULE-CLOSEOUT] Scheduled closeout job at: $when"
fi
echo "[SCHEDULE-CLOSEOUT] Current queue:"
"$ATQ_CMD" || true
