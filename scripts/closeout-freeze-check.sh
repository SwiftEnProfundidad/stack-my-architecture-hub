#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="${SMA_CLOSEOUT_RUNTIME_DIR:-$HUB_ROOT/.runtime}"

ATQ_CMD="${SMA_ATQ_CMD:-atq}"
STATUS_CMD="${SMA_CLOSEOUT_STATUS_CMD:-$SCRIPT_DIR/closeout-status.sh}"
READINESS_CMD="${SMA_CLOSEOUT_READINESS_CMD:-$SCRIPT_DIR/closeout-readiness.sh}"

AUTO_STATUS_FILE="${SMA_CLOSEOUT_AUTO_STATUS_FILE:-$RUNTIME_DIR/auto-closeout-status.env}"
DEPLOY_STATUS_FILE="${SMA_CLOSEOUT_DEPLOY_STATUS_FILE:-$RUNTIME_DIR/deploy-and-verify-last.env}"
COMPLETE_FLAG="${SMA_CLOSEOUT_COMPLETE_FLAG:-$RUNTIME_DIR/closeout-complete.flag}"
FOLLOWUP_LOG_FILE="${SMA_CLOSEOUT_FOLLOWUP_LOG_FILE:-}"

if [[ -z "$FOLLOWUP_LOG_FILE" ]]; then
  FOLLOWUP_LOG_FILE="$(ls -1t "$RUNTIME_DIR"/closeout-followup-*.log 2>/dev/null | head -1 || true)"
fi

if [[ -n "${SMA_CLOSEOUT_FREEZE_REPORT_FILE:-}" ]]; then
  REPORT_FILE="$SMA_CLOSEOUT_FREEZE_REPORT_FILE"
else
  REPORT_FILE="$RUNTIME_DIR/closeout-freeze-check-$(date +%Y%m%dT%H%M%S).md"
fi

mkdir -p "$RUNTIME_DIR"

set +e
status_output="$("$STATUS_CMD" 2>&1)"
status_exit=$?
readiness_output="$("$READINESS_CMD" 2>&1)"
readiness_exit=$?
atq_output="$("$ATQ_CMD" 2>&1)"
atq_exit=$?
set -e

missing=()

deploy_state="missing"
if [[ -f "$DEPLOY_STATUS_FILE" ]]; then
  deploy_state="$(sed -n "s/^state='\\(.*\\)'$/\\1/p" "$DEPLOY_STATUS_FILE" | head -1)"
  if [[ "$deploy_state" != "success" ]]; then
    missing+=("deploy-state-not-success:${deploy_state:-empty}")
  fi
else
  missing+=("deploy-status-missing")
fi

if [[ ! -f "$COMPLETE_FLAG" ]]; then
  missing+=("closeout-complete-flag-missing")
fi

followup_routes_ok=0
followup_functional_ok=0
followup_postchecks_ok=0

if [[ -z "$FOLLOWUP_LOG_FILE" || ! -f "$FOLLOWUP_LOG_FILE" ]]; then
  missing+=("followup-log-missing")
else
  if rg -q "\\[FOLLOWUP\\] smoke-public-routes exit=0" "$FOLLOWUP_LOG_FILE"; then
    followup_routes_ok=1
  else
    missing+=("followup-routes-not-ok")
  fi

  if rg -q "\\[FOLLOWUP\\] smoke-public-functional exit=0" "$FOLLOWUP_LOG_FILE"; then
    followup_functional_ok=1
  else
    missing+=("followup-functional-not-ok")
  fi

  if rg -q "\\[FOLLOWUP\\] post-deploy-checks exit=0" "$FOLLOWUP_LOG_FILE"; then
    followup_postchecks_ok=1
  else
    missing+=("followup-post-checks-not-ok")
  fi
fi

if [[ ${#missing[@]} -eq 0 ]]; then
  result="READY"
  exit_code=0
else
  result="NOT_READY"
  exit_code=2
fi

{
  echo "# CLOSEOUT FREEZE CHECK"
  echo
  echo "- Date: $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "- Hub: $HUB_ROOT"
  echo "- Runtime: $RUNTIME_DIR"
  echo "- Result: $result"
  echo
  echo "## Conditions"
  if [[ "$deploy_state" == "success" ]]; then
    echo "- Deploy state success: ✅ ($deploy_state)"
  else
    echo "- Deploy state success: ❌ (${deploy_state:-missing})"
  fi
  if [[ -f "$COMPLETE_FLAG" ]]; then
    echo "- closeout-complete.flag: ✅"
  else
    echo "- closeout-complete.flag: ❌"
  fi
  if [[ -n "$FOLLOWUP_LOG_FILE" && -f "$FOLLOWUP_LOG_FILE" ]]; then
    echo "- Followup log found: ✅ ($FOLLOWUP_LOG_FILE)"
  else
    echo "- Followup log found: ❌"
  fi
  if [[ "$followup_routes_ok" -eq 1 ]]; then
    echo "- Followup routes check: ✅"
  else
    echo "- Followup routes check: ❌"
  fi
  if [[ "$followup_functional_ok" -eq 1 ]]; then
    echo "- Followup functional check: ✅"
  else
    echo "- Followup functional check: ❌"
  fi
  if [[ "$followup_postchecks_ok" -eq 1 ]]; then
    echo "- Followup post-checks: ✅"
  else
    echo "- Followup post-checks: ❌"
  fi
  echo
  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "## Missing / Blocking"
    for item in "${missing[@]}"; do
      echo "- $item"
    done
    echo
  fi
  echo "## Runtime Snapshots"
  echo "### closeout-status (exit=$status_exit)"
  echo '```text'
  printf '%s\n' "$status_output"
  echo '```'
  echo
  echo "### closeout-readiness (exit=$readiness_exit)"
  echo '```text'
  printf '%s\n' "$readiness_output"
  echo '```'
  echo
  echo "### atq (exit=$atq_exit)"
  echo '```text'
  printf '%s\n' "$atq_output"
  echo '```'
} >"$REPORT_FILE"

echo "[FREEZE-CHECK] Report: $REPORT_FILE"
echo "[FREEZE-CHECK] Result: $result"
exit "$exit_code"
