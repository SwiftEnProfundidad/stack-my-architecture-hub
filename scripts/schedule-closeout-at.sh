#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="$HUB_ROOT/.runtime"

when="${1:-15:50}"
epoch_arg=""
job_script="$SCRIPT_DIR/closeout-at-job.sh"

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

jobs="$(atq 2>/dev/null || true)"
if [[ -n "$jobs" ]]; then
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    job_id="$(printf '%s\n' "$line" | awk '{print $1}')"
    job_body="$(at -c "$job_id" 2>/dev/null || true)"
    if printf '%s\n' "$job_body" | rg -q "closeout-at-job.sh|closeout-at-job\\.sh|closeout-wait-and-run.sh|closeout-at-job"; then
      atrm "$job_id"
      echo "[SCHEDULE-CLOSEOUT] Removed old closeout job: $job_id"
    fi
  done <<<"$jobs"
fi

{
  printf '%s\n' "$job_script"
} | if [[ -n "$epoch_arg" ]]; then
  at -t "$(date -r "$epoch_arg" '+%Y%m%d%H%M.%S')"
else
  at "$when"
fi

if [[ -n "$epoch_arg" ]]; then
  echo "[SCHEDULE-CLOSEOUT] Scheduled closeout job at epoch: $epoch_arg ($(date -r "$epoch_arg" '+%Y-%m-%d %H:%M:%S %Z'))"
else
  echo "[SCHEDULE-CLOSEOUT] Scheduled closeout job at: $when"
fi
echo "[SCHEDULE-CLOSEOUT] Current queue:"
atq || true
