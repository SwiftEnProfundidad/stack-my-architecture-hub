#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI_SCRIPT="$SCRIPT_DIR/stack-hub-cli.sh"
BIN_DIR="${STACK_MY_ARCH_BIN_DIR:-$HOME/.local/bin}"
BIN_PATH="$BIN_DIR/stack-hub"

if [[ ! -f "$CLI_SCRIPT" ]]; then
  echo "❌ No se encontró el CLI base: $CLI_SCRIPT"
  exit 1
fi

mkdir -p "$BIN_DIR"
chmod +x "$CLI_SCRIPT"

cat > "$BIN_PATH" <<EOF
#!/bin/zsh
exec /bin/zsh -f "$CLI_SCRIPT" "\$@"
EOF

chmod +x "$BIN_PATH"

echo "✅ Comando instalado: $BIN_PATH"
echo "✅ Prueba rápida: stack-hub --help"

if ! printf ':%s:' "$PATH" | grep -q ":$BIN_DIR:"; then
  echo "⚠️ $BIN_DIR no está en tu PATH actual."
  echo "   Añade esta línea a ~/.zshrc:"
  echo "   export PATH=\"$BIN_DIR:\$PATH\""
fi
