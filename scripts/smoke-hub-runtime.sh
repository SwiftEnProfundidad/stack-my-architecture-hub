#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BRIDGE_DIR="$HUB_ROOT/assistant-bridge"

TMP_DIR="$(mktemp -d)"
SMOKE_LOG="$TMP_DIR/smoke.log"
PORT="${STACK_MY_ARCH_HUB_SMOKE_PORT:-}"
PID=""

cleanup() {
  if [[ -n "$PID" ]] && kill -0 "$PID" >/dev/null 2>&1; then
    kill "$PID" >/dev/null 2>&1 || true
    wait "$PID" 2>/dev/null || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

pick_port() {
  local candidates=(46210 46211 46212 46213 46214 46215 46216 46217 46218 46219 46220)
  local p
  for p in "${candidates[@]}"; do
    if ! lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "$p"
      return 0
    fi
  done
  return 1
}

wait_health() {
  local port="$1"
  local retries=30
  local i=0
  while [[ "$i" -lt "$retries" ]]; do
    if curl -fsS "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done
  return 1
}

check_http_contains() {
  local url="$1"
  local expected="$2"
  local body="$TMP_DIR/body.txt"
  local code
  code="$(curl -sS -o "$body" -w "%{http_code}" "$url")"
  if [[ "$code" != "200" ]]; then
    echo "[ERROR] ${url} devolvió HTTP ${code}" >&2
    exit 1
  fi
  if ! rg -q --fixed-strings "$expected" "$body"; then
    echo "[ERROR] ${url} no contiene marcador esperado: ${expected}" >&2
    exit 1
  fi
}

check_http_contains_any() {
  local url="$1"
  shift
  local body="$TMP_DIR/body.txt"
  local code
  code="$(curl -sS -o "$body" -w "%{http_code}" "$url")"
  if [[ "$code" != "200" ]]; then
    echo "[ERROR] ${url} devolvió HTTP ${code}" >&2
    exit 1
  fi

  local expected
  for expected in "$@"; do
    if rg -q --fixed-strings "$expected" "$body"; then
      return 0
    fi
  done

  echo "[ERROR] ${url} no contiene ninguno de los marcadores esperados: $*" >&2
  exit 1
}

if [[ -z "$PORT" ]]; then
  PORT="$(pick_port || true)"
fi

if [[ -z "$PORT" ]]; then
  echo "[ERROR] No hay puerto libre para runtime smoke test."
  exit 1
fi

if [[ ! -d "$BRIDGE_DIR" ]]; then
  echo "[ERROR] No existe assistant-bridge: $BRIDGE_DIR"
  exit 1
fi

cd "$BRIDGE_DIR"

if [[ ! -d node_modules ]]; then
  echo "[SMOKE] Instalando dependencias de assistant-bridge..."
  npm install --silent
fi

echo "[SMOKE] Arrancando servidor temporal en puerto $PORT..."
PORT="$PORT" OPENAI_API_KEY="${OPENAI_API_KEY:-smoke-test-key}" nohup node server.js >"$SMOKE_LOG" 2>&1 &
PID=$!

if ! wait_health "$PORT"; then
  echo "[ERROR] El servidor no respondió /health en puerto $PORT" >&2
  echo "[INFO] Log temporal:" >&2
  cat "$SMOKE_LOG" >&2
  exit 1
fi

echo "[SMOKE] Verificando endpoints runtime..."
check_http_contains "http://127.0.0.1:${PORT}/health" "\"ok\":true"
check_http_contains "http://127.0.0.1:${PORT}/config" "\"query_path\":\"/assistant/query\""
check_http_contains "http://127.0.0.1:${PORT}/index.html" "Stack My Architecture · Cursos"
check_http_contains "http://127.0.0.1:${PORT}/ios/index.html" "stack-my-architecture-ios"
check_http_contains "http://127.0.0.1:${PORT}/android/index.html" "stack-my-architecture-android"
check_http_contains "http://127.0.0.1:${PORT}/sdd/index.html" "stack-my-architecture-sdd"
check_http_contains "http://127.0.0.1:${PORT}/ios/assets/study-ux.js" "(function () {"
check_http_contains_any "http://127.0.0.1:${PORT}/ios/assets/assistant-panel.js" "KEY_PROVIDER" "KEY_DAILY_BUDGET"
check_http_contains_any "http://127.0.0.1:${PORT}/android/assets/assistant-panel.js" "KEY_PROVIDER" "KEY_DAILY_BUDGET"
check_http_contains_any "http://127.0.0.1:${PORT}/sdd/assets/assistant-panel.js" "KEY_PROVIDER" "KEY_DAILY_BUDGET"
check_http_contains "http://127.0.0.1:${PORT}/sdd/assets/assistant-panel.js" "KEY_DAILY_BUDGET"

echo "[OK] Runtime smoke test passed (port $PORT)"
