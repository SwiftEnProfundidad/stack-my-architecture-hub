#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${1:-https://architecture-stack.vercel.app}"
BASE_URL="${BASE_URL%/}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

ROUTES_SMOKE="${SMA_POST_DEPLOY_ROUTES_SCRIPT:-$SCRIPT_DIR/smoke-public-routes.sh}"
FUNCTIONAL_SMOKE="${SMA_POST_DEPLOY_FUNCTIONAL_SCRIPT:-$SCRIPT_DIR/smoke-public-functional.sh}"

if [[ ! -x "$ROUTES_SMOKE" ]]; then
  echo "[ERROR] Script no ejecutable o inexistente: $ROUTES_SMOKE"
  exit 1
fi

if [[ ! -x "$FUNCTIONAL_SMOKE" ]]; then
  echo "[ERROR] Script no ejecutable o inexistente: $FUNCTIONAL_SMOKE"
  exit 1
fi

echo "[POST-DEPLOY] Iniciando verificación para: $BASE_URL"
echo "[POST-DEPLOY] Paso 1/2: rutas públicas"
"$ROUTES_SMOKE" "$BASE_URL"

echo "[POST-DEPLOY] Paso 2/2: smoke funcional público"
"$FUNCTIONAL_SMOKE" "$BASE_URL"

echo "[POST-DEPLOY] Verificación completa en verde."
