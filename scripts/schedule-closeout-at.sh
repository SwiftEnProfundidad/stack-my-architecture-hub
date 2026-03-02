#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="$HUB_ROOT/.runtime"

when="${1:-15:50}"
job_script="$SCRIPT_DIR/closeout-at-job.sh"

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
} | at "$when"

echo "[SCHEDULE-CLOSEOUT] Scheduled closeout job at: $when"
echo "[SCHEDULE-CLOSEOUT] Current queue:"
atq || true
