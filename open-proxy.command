#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

on_error() {
  echo ""
  echo "❌ Error arrancando el proxy."
  echo "Pulsa ENTER para cerrar esta ventana..."
  read _
}
trap on_error ERR

if [ -z "${OPENAI_API_KEY:-}" ]; then
  if [ -f "$HOME/.zshrc" ]; then
    source "$HOME/.zshrc" >/dev/null 2>&1 || true
  fi
fi

if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "No se encontró OPENAI_API_KEY en el entorno."
  echo "Pégala ahora (se usará solo para esta sesión):"
  echo -n "OPENAI_API_KEY="
  read -r OPENAI_API_KEY
  export OPENAI_API_KEY
fi

if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "ERROR: OPENAI_API_KEY no puede estar vacía."
  exit 1
fi

cd "$SCRIPT_DIR/assistant-bridge"

echo "📦 Instalando dependencias..."
npm install

echo "🚀 Arrancando Hub + proxy en http://localhost:8090"
(sleep 2; open "http://localhost:8090/index.html") >/dev/null 2>&1 &

npm start
