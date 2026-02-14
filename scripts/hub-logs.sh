#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="$HUB_ROOT/.runtime"
LOG_FILE="$RUNTIME_DIR/hub.log"

LINES="${STACK_MY_ARCH_LOG_LINES:-120}"

if ! [[ "$LINES" =~ ^[0-9]+$ ]]; then
  echo "❌ STACK_MY_ARCH_LOG_LINES inválido: $LINES"
  exit 1
fi

if [ ! -f "$LOG_FILE" ]; then
  echo "ℹ️ No existe log todavía: $LOG_FILE"
  exit 0
fi

if [ "${1:-}" = "--follow" ] || [ "${1:-}" = "-f" ]; then
  exec tail -n "$LINES" -f "$LOG_FILE"
fi

exec tail -n "$LINES" "$LOG_FILE"
