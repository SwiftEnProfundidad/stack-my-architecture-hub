#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${1:-8090}"

echo "[1/2] Sirviendo Hub en http://localhost:${PORT} ..."
echo "[2/2] Abriendo navegador..."
open "http://localhost:${PORT}/index.html" 2>/dev/null || true

cd "${ROOT_DIR}"
python3 -m http.server "${PORT}"

