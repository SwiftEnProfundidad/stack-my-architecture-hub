#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="$HUB_ROOT/.runtime"
PID_FILE="$RUNTIME_DIR/hub.pid"
PORT_FILE="$RUNTIME_DIR/hub.port"

stopped=0

stop_pid() {
  local target_pid="$1"
  if [ -z "$target_pid" ] || ! [[ "$target_pid" =~ ^[0-9]+$ ]]; then
    return 1
  fi
  if ! kill -0 "$target_pid" >/dev/null 2>&1; then
    return 1
  fi
  kill "$target_pid" >/dev/null 2>&1 || true
  sleep 1
  if kill -0 "$target_pid" >/dev/null 2>&1; then
    kill -9 "$target_pid" >/dev/null 2>&1 || true
  fi
  return 0
}

pid="$(cat "$PID_FILE" 2>/dev/null || true)"
if stop_pid "$pid"; then
  echo "🛑 Hub detenido (PID $pid)."
  stopped=1
elif [ -n "$pid" ]; then
  echo "ℹ️ El proceso PID $pid ya no estaba activo."
fi

port="$(cat "$PORT_FILE" 2>/dev/null || true)"
if [ -n "$port" ] && [[ "$port" =~ ^[0-9]+$ ]]; then
  pids_on_port="$(lsof -t -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | sort -u || true)"
  if [ -n "$pids_on_port" ]; then
    while IFS= read -r p; do
      if [ -n "$p" ] && stop_pid "$p"; then
        echo "🛑 Listener detenido en puerto $port (PID $p)."
        stopped=1
      fi
    done <<< "$pids_on_port"
  fi
fi

if [ "$stopped" -eq 0 ]; then
  echo "ℹ️ No había proceso activo del hub para detener."
fi

rm -f "$PID_FILE" "$PORT_FILE"
