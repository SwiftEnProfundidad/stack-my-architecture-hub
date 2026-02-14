#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BRIDGE_DIR="$HUB_ROOT/assistant-bridge"
RUNTIME_DIR="$HUB_ROOT/.runtime"
SELFTEST_LOG="$RUNTIME_DIR/hub-selftest.log"
SELFTEST_PID=""
STRICT_MODE=0

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

usage() {
  cat <<'EOF'
Uso:
  hub-selftest.sh [--strict]

Opciones:
  --strict   Ejecuta además una consulta real al endpoint /assistant/query.
  -h, --help Muestra ayuda.

Notas:
  - En modo --strict se consume una llamada real de API (coste muy bajo).
  - Puedes fijar puerto base con STACK_MY_ARCH_SELFTEST_PORT.
EOF
}

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

extract_key_from_file() {
  local file="$1"
  if [ ! -f "$file" ]; then
    return 1
  fi
  local raw_key
  raw_key="$(grep -E '^[[:space:]]*(export[[:space:]]+)?OPENAI_API_KEY=' "$file" | tail -n 1 || true)"
  if [ -z "$raw_key" ]; then
    return 1
  fi
  raw_key="${raw_key#export }"
  raw_key="${raw_key#OPENAI_API_KEY=}"
  raw_key="${raw_key%%#*}"
  raw_key="$(printf '%s' "$raw_key" | sed -E "s/^[[:space:]]+|[[:space:]]+$//g")"
  raw_key="${raw_key#\"}"
  raw_key="${raw_key%\"}"
  raw_key="${raw_key#\'}"
  raw_key="${raw_key%\'}"
  if [ -z "$raw_key" ]; then
    return 1
  fi
  printf '%s' "$raw_key"
}

resolve_api_key_for_strict() {
  if [ -n "${OPENAI_API_KEY:-}" ]; then
    printf '%s' "$OPENAI_API_KEY"
    return 0
  fi

  local key=""
  key="$(extract_key_from_file "$BRIDGE_DIR/.env" || true)"
  if [ -n "$key" ]; then
    printf '%s' "$key"
    return 0
  fi

  key="$(extract_key_from_file "$HOME/.zshrc" || true)"
  if [ -n "$key" ]; then
    printf '%s' "$key"
    return 0
  fi

  return 1
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --strict)
        STRICT_MODE=1
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        echo "❌ Opción no reconocida: $1"
        usage
        exit 1
        ;;
    esac
  done
}

main() {
  parse_args "$@"

  ensure_command node
  ensure_command npm
  ensure_command curl
  ensure_command python3

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
  if [ "$STRICT_MODE" -eq 1 ]; then
    local strict_api_key
    strict_api_key="$(resolve_api_key_for_strict || true)"
    if [ -z "$strict_api_key" ]; then
      echo "❌ Selftest strict requiere OPENAI_API_KEY disponible (env, assistant-bridge/.env o ~/.zshrc)."
      exit 1
    fi
    api_key="$strict_api_key"
  fi

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

  if [ "$STRICT_MODE" -eq 1 ]; then
    local response_file
    response_file="$(mktemp /tmp/stack-hub-selftest-response-XXXX.json)"
    local payload='{"message":"Selftest strict ping. Return a short sentence.","model":"gpt-4o-mini","maxTokens":80,"context":{"courseId":"stack-hub-selftest","topicId":"strict"}}'

    code="$(curl -sS -o "$response_file" -w '%{http_code}' -H 'Content-Type: application/json' -d "$payload" "http://127.0.0.1:${port}/assistant/query")"
    assert_http_code "POST /assistant/query (strict real call)" "200" "$code"

    if ! python3 - "$response_file" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as f:
    data = json.load(f)

if not data.get("ok"):
    raise SystemExit("response.ok=false")

answer = str(data.get("answer", "")).strip()
if not answer:
    raise SystemExit("answer vacío")

print(f"✅ Strict answer chars: {len(answer)}")
PY
    then
      rm -f "$response_file"
      echo "❌ Selftest strict: respuesta inválida del asistente."
      exit 1
    fi

    rm -f "$response_file"
  fi

  echo "✅ Selftest completado correctamente."
  echo "📝 Log selftest: $SELFTEST_LOG"
}

main "$@"
