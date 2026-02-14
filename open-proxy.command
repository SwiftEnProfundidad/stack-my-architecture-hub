#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOCAL_CLI="$SCRIPT_DIR/scripts/stack-hub-cli.sh"
GLOBAL_CLI="${STACK_MY_ARCH_CLI_PATH:-$HOME/.local/bin/stack-hub}"

if [ -x "$GLOBAL_CLI" ]; then
  exec /bin/zsh -f "$GLOBAL_CLI" "$@"
fi

if [ ! -x "$LOCAL_CLI" ]; then
  chmod +x "$LOCAL_CLI"
fi

exec /bin/zsh -f "$LOCAL_CLI" "$@"
