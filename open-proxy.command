#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LAUNCH_SCRIPT="$SCRIPT_DIR/scripts/launch-hub.sh"

if [ ! -x "$LAUNCH_SCRIPT" ]; then
  chmod +x "$LAUNCH_SCRIPT"
fi

exec /bin/zsh -f "$LAUNCH_SCRIPT" "$@"
