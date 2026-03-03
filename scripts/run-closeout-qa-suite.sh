#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

MODE="${1:-full}"
ATQ_CMD="${SMA_ATQ_CMD:-atq}"
CLOSEOUT_STATUS_CMD="${SMA_CLOSEOUT_STATUS_CMD:-$SCRIPT_DIR/closeout-status.sh}"
CLOSEOUT_READINESS_CMD="${SMA_CLOSEOUT_READINESS_CMD:-$SCRIPT_DIR/closeout-readiness.sh}"
TESTS_FILE="${SMA_CLOSEOUT_QA_TESTS_FILE:-}"

if [[ "$MODE" != "full" && "$MODE" != "tests" ]]; then
  echo "Uso: $0 [full|tests]"
  exit 1
fi

TESTS=()
if [[ -n "$TESTS_FILE" ]]; then
  if [[ ! -f "$TESTS_FILE" ]]; then
    echo "[CLOSEOUT-QA] ERROR: SMA_CLOSEOUT_QA_TESTS_FILE no existe: $TESTS_FILE"
    exit 1
  fi
  while IFS= read -r test_script || [[ -n "$test_script" ]]; do
    [[ -z "$test_script" ]] && continue
    TESTS+=("$test_script")
  done < "$TESTS_FILE"
else
  TESTS=(
    "$SCRIPT_DIR/tests/test-closeout-wait-and-run.sh"
    "$SCRIPT_DIR/tests/test-closeout-at-job.sh"
    "$SCRIPT_DIR/tests/test-closeout-readiness.sh"
    "$SCRIPT_DIR/tests/test-schedule-closeout-at.sh"
    "$SCRIPT_DIR/tests/test-schedule-closeout-window.sh"
    "$SCRIPT_DIR/tests/test-recover-past-due-closeout.sh"
    "$SCRIPT_DIR/tests/test-closeout-window-followup.sh"
    "$SCRIPT_DIR/tests/test-deploy-and-verify-closeout.sh"
    "$SCRIPT_DIR/tests/test-closeout-status.sh"
    "$SCRIPT_DIR/tests/test-run-closeout-qa-suite.sh"
  )
fi

echo "[CLOSEOUT-QA] Hub: $HUB_ROOT"
echo "[CLOSEOUT-QA] Mode: $MODE"
echo "[CLOSEOUT-QA] Running ${#TESTS[@]} regression tests..."

for test_script in "${TESTS[@]}"; do
  if [[ ! -x "$test_script" ]]; then
    echo "[CLOSEOUT-QA] ERROR: script no ejecutable: $test_script"
    exit 1
  fi
  echo "[CLOSEOUT-QA] -> $(basename "$test_script")"
  "$test_script"
done

if [[ "$MODE" == "full" ]]; then
  echo "[CLOSEOUT-QA] Runtime check: atq"
  "$ATQ_CMD"

  echo "[CLOSEOUT-QA] Runtime check: closeout-status"
  set +e
  "$CLOSEOUT_STATUS_CMD"
  status_code=$?
  set -e

  if [[ "$status_code" -eq 0 ]]; then
    echo "[CLOSEOUT-QA] closeout-status -> LISTO (0)"
  elif [[ "$status_code" -eq 2 ]]; then
    echo "[CLOSEOUT-QA] closeout-status -> EN ESPERA por cooldown (2)"
  elif [[ "$status_code" -eq 3 ]]; then
    echo "[CLOSEOUT-QA] ERROR: cooldown activo con ventana incompleta (3)."
    exit 3
  else
    echo "[CLOSEOUT-QA] ERROR: closeout-status devolvió código inesperado ($status_code)."
    exit "$status_code"
  fi

  echo "[CLOSEOUT-QA] Runtime check: closeout-readiness"
  set +e
  "$CLOSEOUT_READINESS_CMD"
  readiness_code=$?
  set -e

  if [[ "$readiness_code" -eq 0 ]]; then
    echo "[CLOSEOUT-QA] closeout-readiness -> LISTO (0)"
  elif [[ "$readiness_code" -eq 2 ]]; then
    echo "[CLOSEOUT-QA] closeout-readiness -> EN ESPERA por cooldown (2)"
  elif [[ "$readiness_code" -eq 3 ]]; then
    echo "[CLOSEOUT-QA] ERROR: cooldown activo sin job automático en cola (3)."
    exit 3
  else
    echo "[CLOSEOUT-QA] ERROR: closeout-readiness devolvió código inesperado ($readiness_code)."
    exit "$readiness_code"
  fi
fi

echo "[CLOSEOUT-QA] Suite completada en verde."
