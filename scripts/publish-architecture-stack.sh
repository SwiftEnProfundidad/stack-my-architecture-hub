#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

MODE="${1:-fast}"
if [[ "$MODE" != "fast" && "$MODE" != "strict" ]]; then
  echo "Uso: $0 [fast|strict]"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "Error: python3 no esta disponible en PATH."
  exit 1
fi

echo "[1/3] Building hub (mode=$MODE)..."
"$SCRIPT_DIR/build-hub.sh" --mode "$MODE"

echo "[2/3] Deploying production to Vercel..."
DEPLOY_OUTPUT="$(cd "$HUB_ROOT" && npx -y vercel deploy --prod --yes)"
echo "$DEPLOY_OUTPUT"

BASE_URL="https://architecture-stack.vercel.app"
echo "[3/3] Verifying public routes..."

for path in "/" "/ios/" "/android/" "/sdd/"; do
  code="$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${path}")"
  echo "  ${BASE_URL}${path} -> ${code}"
  if [[ "$code" != "200" ]]; then
    echo "Error: route verification failed for ${BASE_URL}${path}"
    exit 1
  fi
done

echo
echo "Publicado correctamente:"
echo "  ${BASE_URL}"
echo "  ${BASE_URL}/ios/"
echo "  ${BASE_URL}/android/"
echo "  ${BASE_URL}/sdd/"
