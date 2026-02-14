#!/bin/zsh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="$SCRIPT_DIR/scripts/stack-hub-cli.sh"

if [ ! -x "$CLI" ]; then
  chmod +x "$CLI"
fi

exec /bin/zsh -f "$CLI" hub --force-rebuild
