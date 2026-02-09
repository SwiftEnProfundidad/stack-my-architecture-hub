#!/bin/zsh
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
chmod +x "$SCRIPT_DIR/scripts/serve-hub.sh"
"$SCRIPT_DIR/scripts/serve-hub.sh" 8090
