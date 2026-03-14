#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${1:-8090}"
NO_CACHE_SERVER="$ROOT_DIR/scripts/no_cache_http_server.py"

echo "[1/2] Sirviendo Hub en http://localhost:${PORT} ..."
echo "[2/2] Abriendo navegador..."
open "http://localhost:${PORT}/index.html" 2>/dev/null || true

cd "${ROOT_DIR}"
python3 "$NO_CACHE_SERVER" --port "${PORT}" --directory "${ROOT_DIR}"
