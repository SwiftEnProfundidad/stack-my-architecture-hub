#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BRIDGE_DIR="$HUB_ROOT/assistant-bridge"
RUNTIME_DIR="$HUB_ROOT/.runtime"
SELFTEST_LOG="$RUNTIME_DIR/hub-selftest.log"
SELFTEST_PID=""

mkdir -p "$RUNTIME_DIR"

cleanup() {
  local pid="${SELFTEST_PID:-}"
  if [ -z "$pid" ] || ! [[ "$pid" =~ ^[0-9]+$ ]]; then
    return 0
  fi
  if kill -0 "$pid" >/dev/null 2>&1; then
    kill "$pid" >/dev/null 2>&1 || true
    sleep 1
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill -9 "$pid" >/dev/null 2>&1 || true
    fi
  fi
}

trap cleanup EXIT INT TERM

is_port_listening() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

pick_free_port() {
  local base="${STACK_MY_ARCH_SELFTEST_PORT:-47600}"
  if ! [[ "$base" =~ ^[0-9]+$ ]]; then
    base=47600
  fi
  local i=0
  while [ "$i" -lt 60 ]; do
    local candidate=$((base + i))
    if [ "$candidate" -ge 1024 ] && [ "$candidate" -le 65535 ] && ! is_port_listening "$candidate"; then
      echo "$candidate"
      return 0
    fi
    i=$((i + 1))
  done
  return 1
}

wait_health() {
  local port="$1"
  local retries=25
  local i=0
  while [ "$i" -lt "$retries" ]; do
    if curl -fsS "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done
  return 1
}

assert_http_code() {
  local label="$1"
  local expected="$2"
  local code="$3"
  if [ "$code" != "$expected" ]; then
    echo "❌ $label: esperado=$expected obtenido=$code"
    return 1
  fi
  echo "✅ $label: $code"
}

ensure_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "❌ Falta comando requerido: $cmd"
    exit 1
  fi
}

main() {
  ensure_command node
  ensure_command npm
  ensure_command curl

  if [ ! -d "$BRIDGE_DIR" ]; then
    echo "❌ No existe assistant-bridge: $BRIDGE_DIR"
    exit 1
  fi

  local port
  port="$(pick_free_port || true)"
  if [ -z "$port" ]; then
    echo "❌ No se encontró puerto libre para selftest."
    exit 1
  fi

  cd "$BRIDGE_DIR"
  if [ ! -d node_modules ]; then
    echo "📦 Selftest: instalando dependencias de assistant-bridge..."
    npm install --silent
  fi

  : > "$SELFTEST_LOG"
  local api_key="${OPENAI_API_KEY:-selftest-key}"
  PORT="$port" OPENAI_API_KEY="$api_key" nohup node server.js >>"$SELFTEST_LOG" 2>&1 &
  SELFTEST_PID="$!"

  echo "🔎 Selftest arrancando en puerto temporal $port (pid=$SELFTEST_PID)..."
  if ! wait_health "$port"; then
    echo "❌ Selftest: /health no respondió a tiempo."
    tail -n 60 "$SELFTEST_LOG" || true
    exit 1
  fi

  local code

  code="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${port}/health")"
  assert_http_code "GET /health" "200" "$code"

  code="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${port}/config")"
  assert_http_code "GET /config" "200" "$code"

  code="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${port}/ios/index.html")"
  assert_http_code "GET /ios/index.html" "200" "$code"

  code="$(curl -sS -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -d '{}' "http://127.0.0.1:${port}/assistant/query")"
  assert_http_code "POST /assistant/query (body vacío)" "400" "$code"

  code="$(curl -sS -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -d '{}' "http://127.0.0.1:${port}/ask")"
  assert_http_code "POST /ask alias (body vacío)" "400" "$code"

  echo "✅ Selftest completado correctamente."
  echo "📝 Log selftest: $SELFTEST_LOG"
}

main "$@"
