#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

MODE="${1:-full}"

if [[ "$MODE" != "full" && "$MODE" != "tests" ]]; then
  echo "Uso: $0 [full|tests]"
  exit 1
fi

TESTS=(
  "$SCRIPT_DIR/tests/test-closeout-wait-and-run.sh"
  "$SCRIPT_DIR/tests/test-closeout-at-job.sh"
  "$SCRIPT_DIR/tests/test-closeout-readiness.sh"
  "$SCRIPT_DIR/tests/test-schedule-closeout-at.sh"
  "$SCRIPT_DIR/tests/test-deploy-and-verify-closeout.sh"
  "$SCRIPT_DIR/tests/test-closeout-status.sh"
)

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
  atq

  echo "[CLOSEOUT-QA] Runtime check: closeout-readiness"
  set +e
  "$SCRIPT_DIR/closeout-readiness.sh"
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
