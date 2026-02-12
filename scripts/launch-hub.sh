#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BRIDGE_DIR="$HUB_ROOT/assistant-bridge"
RUNTIME_DIR="$HUB_ROOT/.runtime"
PID_FILE="$RUNTIME_DIR/hub.pid"
PORT_FILE="$RUNTIME_DIR/hub.port"
LOG_FILE="$RUNTIME_DIR/hub.log"

mkdir -p "$RUNTIME_DIR"

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

resolve_api_key() {
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

  if [ -t 0 ] && [ -t 1 ]; then
    echo "No se encontró OPENAI_API_KEY en assistant-bridge/.env ni en ~/.zshrc."
    echo -n "Pega OPENAI_API_KEY (entrada oculta): "
    read -rs key
    echo ""
    if [ -n "$key" ]; then
      printf '%s' "$key"
      return 0
    fi
  fi

  return 1
}

is_port_listening() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

health_ok() {
  local port="$1"
  curl -fsS "http://127.0.0.1:${port}/health" >/dev/null 2>&1
}

wait_health() {
  local port="$1"
  local retries="$2"
  local i
  i=0
  while [ "$i" -lt "$retries" ]; do
    if health_ok "$port"; then
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done
  return 1
}

cleanup_stale_pid() {
  if [ ! -f "$PID_FILE" ]; then
    return 0
  fi
  local pid
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -z "$pid" ]; then
    rm -f "$PID_FILE"
    return 0
  fi
  if kill -0 "$pid" >/dev/null 2>&1; then
    return 0
  fi
  rm -f "$PID_FILE"
}

pick_port() {
  local candidates=()

  if [ -n "${STACK_MY_ARCH_HUB_PORT:-}" ]; then
    candidates+=("${STACK_MY_ARCH_HUB_PORT}")
  fi

  if [ -f "$PORT_FILE" ]; then
    local remembered
    remembered="$(cat "$PORT_FILE" 2>/dev/null || true)"
    if [ -n "$remembered" ]; then
      candidates+=("$remembered")
    fi
  fi

  candidates+=(46100 46101 46102 46103 46104 46105 46110 47090 48090 58090 8090)

  local seen=","
  local port
  for port in "${candidates[@]}"; do
    if ! [[ "$port" =~ ^[0-9]+$ ]]; then
      continue
    fi
    if [ "$port" -lt 1024 ] || [ "$port" -gt 65535 ]; then
      continue
    fi
    if [[ "$seen" == *",$port,"* ]]; then
      continue
    fi
    seen="${seen}${port},"

    if health_ok "$port"; then
      echo "$port"
      return 0
    fi

    if ! is_port_listening "$port"; then
      echo "$port"
      return 0
    fi
  done

  return 1
}

start_server() {
  local port="$1"
  local api_key="$2"

  cd "$BRIDGE_DIR"

  if [ ! -d node_modules ]; then
    echo "📦 Instalando dependencias (primera vez)..."
    npm install --silent
  fi

  : > "$LOG_FILE"
  PORT="$port" OPENAI_API_KEY="$api_key" nohup node server.js >>"$LOG_FILE" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_FILE"
  echo "$port" > "$PORT_FILE"

  if ! wait_health "$port" 25; then
    echo "❌ El servidor no respondió en el puerto $port."
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
    rm -f "$PID_FILE"
    return 1
  fi
}

open_course() {
  local port="$1"
  local course="${2:-hub}"
  local path="/index.html"

  case "$course" in
    ios) path="/ios/index.html" ;;
    android) path="/android/index.html" ;;
    sdd) path="/sdd/index.html" ;;
    hub|"") path="/index.html" ;;
    *)
      echo "⚠️ Curso desconocido: $course"
      echo "Usa: ios | android | sdd | hub"
      path="/index.html"
      ;;
  esac

  local url="http://127.0.0.1:${port}${path}"
  open "$url" >/dev/null 2>&1 || true
  echo "✅ Hub listo en: http://127.0.0.1:${port}/index.html"
  echo "✅ Abierto en el navegador: $url"
}

main() {
  cleanup_stale_pid

  local course="hub"
  if [ "${1:-}" = "--course" ] && [ -n "${2:-}" ]; then
    course="$2"
    shift 2
  elif [ -n "${1:-}" ]; then
    course="$1"
    shift 1
  fi

  local api_key
  api_key="$(resolve_api_key || true)"
  if [ -z "$api_key" ]; then
    echo "❌ OPENAI_API_KEY no está configurada."
    echo "Define OPENAI_API_KEY o crea assistant-bridge/.env con OPENAI_API_KEY=..."
    exit 1
  fi

  local port
  port="$(pick_port || true)"
  if [ -z "$port" ]; then
    echo "❌ No se encontró puerto libre para el hub."
    exit 1
  fi

  if health_ok "$port"; then
    echo "ℹ️ Hub ya activo en puerto $port."
    open_course "$port" "$course"
    exit 0
  fi

  if is_port_listening "$port"; then
    echo "❌ El puerto $port está ocupado por otro proceso y no es el hub."
    echo "Prueba con STACK_MY_ARCH_HUB_PORT=<puerto_libre>."
    exit 1
  fi

  echo "🚀 Arrancando Hub + proxy en puerto $port ..."
  start_server "$port" "$api_key"
  open_course "$port" "$course"
  echo "📝 Log: $LOG_FILE"
}

main "$@"
