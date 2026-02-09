#!/bin/zsh
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
"$SCRIPT_DIR/scripts/build-hub.sh"
open "$SCRIPT_DIR/index.html"
