#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${1:-https://architecture-stack.vercel.app}"

if ! command -v curl >/dev/null 2>&1; then
  echo "[ERROR] curl no esta disponible en PATH."
  exit 1
fi

check_route() {
  local path="$1"
  local url="${BASE_URL}${path}"
  local tmp
  local code

  tmp="$(mktemp)"
  code="$(curl -sS -L -o "$tmp" -w "%{http_code}" "$url" || true)"

  if [[ "$code" != "200" ]]; then
    echo "[FAIL] ${url} -> ${code}"
    rm -f "$tmp"
    return 1
  fi

  if ! grep -qi "<html" "$tmp"; then
    echo "[FAIL] ${url} -> 200 pero respuesta no parece HTML valido"
    rm -f "$tmp"
    return 1
  fi

  echo "[OK] ${url} -> ${code}"
  rm -f "$tmp"
  return 0
}

echo "[SMOKE-PUBLIC] Verificando rutas publicas en: ${BASE_URL}"

check_route "/"
check_route "/ios/"
check_route "/android/"
check_route "/sdd/"

echo "[SMOKE-PUBLIC] Todas las rutas publicas responden correctamente."
