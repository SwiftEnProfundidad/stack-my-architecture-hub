#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RUNNER_DIR="$HUB_ROOT/.runtime/playwright-runner"
RUNNER_NODE_MODULES="$RUNNER_DIR/node_modules"
NODE_SCRIPT="$SCRIPT_DIR/run-interview-mode-smoke.cjs"

TMP_DIR="$(mktemp -d)"
LOG_DIR="$TMP_DIR/logs"
PORT="$(python3 - <<'PY'
import socket
s = socket.socket()
s.bind(("127.0.0.1", 0))
print(s.getsockname()[1])
s.close()
PY
)"
SERVER_PID=""

cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$LOG_DIR" "$RUNNER_DIR"

if [[ ! -d "$RUNNER_NODE_MODULES/playwright" ]]; then
  npm init -y --prefix "$RUNNER_DIR" >/dev/null 2>&1
  npm install --prefix "$RUNNER_DIR" playwright@1.52.0 >/dev/null
fi

cd "$HUB_ROOT"
python3 -m http.server "$PORT" >"$LOG_DIR/server.log" 2>&1 &
SERVER_PID="$!"
sleep 1

NODE_PATH="$RUNNER_NODE_MODULES" \
SMA_INTERVIEW_SMOKE_BASE_URL="http://127.0.0.1:$PORT" \
SMA_INTERVIEW_SMOKE_ARTIFACT_DIR="$TMP_DIR/artifacts" \
node "$NODE_SCRIPT"
