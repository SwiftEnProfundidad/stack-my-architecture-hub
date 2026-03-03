#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="${SMA_CLOSEOUT_RUNTIME_DIR:-$HUB_ROOT/.runtime}"

ATQ_CMD="${SMA_ATQ_CMD:-atq}"
STATUS_CMD="${SMA_CLOSEOUT_STATUS_CMD:-$SCRIPT_DIR/closeout-status.sh}"
READINESS_CMD="${SMA_CLOSEOUT_READINESS_CMD:-$SCRIPT_DIR/closeout-readiness.sh}"

AUTO_STATUS_FILE="${SMA_CLOSEOUT_AUTO_STATUS_FILE:-$RUNTIME_DIR/auto-closeout-status.env}"
COMPLETE_FLAG="${SMA_CLOSEOUT_COMPLETE_FLAG:-$RUNTIME_DIR/closeout-complete.flag}"

mkdir -p "$RUNTIME_DIR"

if [[ -n "${SMA_CLOSEOUT_FOLLOWUP_LOG_FILE:-}" ]]; then
  LOG_FILE="${SMA_CLOSEOUT_FOLLOWUP_LOG_FILE}"
else
  LOG_FILE="$RUNTIME_DIR/closeout-followup-$(date +%Y%m%dT%H%M%S).log"
fi

log_cmd() {
  local title="$1"
  shift
  {
    echo
    echo "[FOLLOWUP] >>> $title"
  } >>"$LOG_FILE"

  set +e
  "$@" >>"$LOG_FILE" 2>&1
  local cmd_code=$?
  set -e

  echo "[FOLLOWUP] $title exit=$cmd_code" >>"$LOG_FILE"
  return 0
}

{
  echo "[FOLLOWUP] Hub: $HUB_ROOT"
  echo "[FOLLOWUP] Date: $(date '+%Y-%m-%d %H:%M:%S %Z')"
} >"$LOG_FILE"

log_cmd "atq" "$ATQ_CMD"
log_cmd "closeout-status" "$STATUS_CMD"
log_cmd "closeout-readiness" "$READINESS_CMD"

if [[ -f "$AUTO_STATUS_FILE" ]]; then
  {
    echo
    echo "[FOLLOWUP] >>> auto-closeout-status.env"
    cat "$AUTO_STATUS_FILE"
  } >>"$LOG_FILE"
else
  echo "[FOLLOWUP] auto-closeout-status.env missing: $AUTO_STATUS_FILE" >>"$LOG_FILE"
fi

if [[ -f "$COMPLETE_FLAG" ]]; then
  echo "[FOLLOWUP] closeout-complete.flag present: $COMPLETE_FLAG" >>"$LOG_FILE"
else
  echo "[FOLLOWUP] closeout-complete.flag absent: $COMPLETE_FLAG" >>"$LOG_FILE"
fi

echo "[FOLLOWUP] Log: $LOG_FILE"
