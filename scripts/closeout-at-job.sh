#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="$HUB_ROOT/.runtime"

mkdir -p "$RUNTIME_DIR"

timestamp="$(date +%Y%m%dT%H%M%S)"
log_file="$RUNTIME_DIR/auto-closeout-${timestamp}.log"
status_file="$RUNTIME_DIR/auto-closeout-status.env"

set +e
"$SCRIPT_DIR/closeout-wait-and-run.sh" fast "https://architecture-stack.vercel.app" >"$log_file" 2>&1
exit_code=$?
set -e

{
  echo "last_run_at='$(date '+%Y-%m-%d %H:%M:%S %Z')'"
  echo "last_log_file='$log_file'"
  echo "last_exit_code=$exit_code"
} >"$status_file"

exit "$exit_code"
