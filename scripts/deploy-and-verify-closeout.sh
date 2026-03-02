#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

MODE="${1:-fast}"
BASE_URL="${2:-https://architecture-stack.vercel.app}"

if [[ "$MODE" != "fast" && "$MODE" != "strict" ]]; then
  echo "Uso: $0 [fast|strict] [base_url]"
  exit 1
fi

PUBLISH_SCRIPT="$SCRIPT_DIR/publish-architecture-stack.sh"
POST_DEPLOY_CHECKS="$SCRIPT_DIR/post-deploy-checks.sh"

if [[ ! -x "$PUBLISH_SCRIPT" ]]; then
  echo "[ERROR] Script no ejecutable o inexistente: $PUBLISH_SCRIPT"
  exit 1
fi

if [[ ! -x "$POST_DEPLOY_CHECKS" ]]; then
  echo "[ERROR] Script no ejecutable o inexistente: $POST_DEPLOY_CHECKS"
  exit 1
fi

echo "[CLOSEOUT] Paso 1/2: deploy productivo (mode=$MODE)"
"$PUBLISH_SCRIPT" "$MODE"

echo "[CLOSEOUT] Paso 2/2: verificación post-deploy"
"$POST_DEPLOY_CHECKS" "$BASE_URL"

echo "[CLOSEOUT] Deploy + verificación final completados en verde."
