#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="$HUB_ROOT/.runtime"
COOLDOWN_FILE="$RUNTIME_DIR/vercel-deploy-cooldown.env"
COMPLETE_FLAG="$RUNTIME_DIR/closeout-complete.flag"
AUTO_RESCHEDULE="${SMA_CLOSEOUT_AUTO_RESCHEDULE:-1}"
RESCHEDULE_OFFSET_SECONDS="${SMA_CLOSEOUT_RESCHEDULE_OFFSET_SECONDS:-60}"

if [[ ! "$RESCHEDULE_OFFSET_SECONDS" =~ ^[0-9]+$ ]]; then
  RESCHEDULE_OFFSET_SECONDS=60
fi

mkdir -p "$RUNTIME_DIR"

timestamp="$(date +%Y%m%dT%H%M%S)"
log_file="$RUNTIME_DIR/auto-closeout-${timestamp}.log"
status_file="$RUNTIME_DIR/auto-closeout-status.env"

set +e
"$SCRIPT_DIR/closeout-wait-and-run.sh" fast "https://architecture-stack.vercel.app" >"$log_file" 2>&1
exit_code=$?
set -e

next_retry_at=""
next_retry_epoch=""
next_retry_reason=""

if [[ "$exit_code" -eq 0 ]]; then
  touch "$COMPLETE_FLAG"
else
  rm -f "$COMPLETE_FLAG"

  if [[ "$AUTO_RESCHEDULE" == "1" ]] && [[ -f "$COOLDOWN_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$COOLDOWN_FILE"

    not_before_epoch="${not_before_epoch:-0}"
    reason="${reason:-unknown}"

    if [[ "$not_before_epoch" =~ ^[0-9]+$ ]] && [[ "$not_before_epoch" -gt 0 ]]; then
      next_epoch="$((not_before_epoch + RESCHEDULE_OFFSET_SECONDS))"
      next_retry_epoch="$next_epoch"
      next_retry_at="$(date -r "$next_epoch" '+%H:%M %Y-%m-%d')"
      next_retry_reason="$reason"
      "$SCRIPT_DIR/schedule-closeout-at.sh" --epoch "$next_epoch" >>"$log_file" 2>&1 || true
    fi
  fi
fi

{
  echo "last_run_at='$(date '+%Y-%m-%d %H:%M:%S %Z')'"
  echo "last_log_file='$log_file'"
  echo "last_exit_code=$exit_code"
  echo "auto_reschedule='$AUTO_RESCHEDULE'"
  echo "next_retry_epoch='${next_retry_epoch}'"
  echo "next_retry_at='${next_retry_at}'"
  echo "next_retry_reason='${next_retry_reason}'"
} >"$status_file"

exit "$exit_code"
