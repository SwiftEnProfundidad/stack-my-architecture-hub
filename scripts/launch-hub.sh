#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BRIDGE_DIR="$HUB_ROOT/assistant-bridge"
RUNTIME_DIR="$HUB_ROOT/.runtime"
PID_FILE="$RUNTIME_DIR/hub.pid"
PORT_FILE="$RUNTIME_DIR/hub.port"
LOG_FILE="$RUNTIME_DIR/hub.log"
MANIFEST_FILE="$RUNTIME_DIR/build-manifest.json"
BUILD_SCRIPT="$SCRIPT_DIR/build-hub.sh"
PROJECTS_ROOT="$(cd "$HUB_ROOT/.." && pwd)"
IOS_REPO="$PROJECTS_ROOT/stack-my-architecture-ios"
ANDROID_REPO="$PROJECTS_ROOT/stack-my-architecture-android"
SDD_REPO="$PROJECTS_ROOT/stack-my-architecture-SDD"

mkdir -p "$RUNTIME_DIR"

# Desktop app launches may not include Homebrew in PATH.
DEFAULT_PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH:-$DEFAULT_PATH}"

resolve_binary() {
  local tool="$1"
  shift

  local candidate
  candidate="$(command -v "$tool" 2>/dev/null || true)"
  if [ -n "$candidate" ]; then
    printf '%s' "$candidate"
    return 0
  fi

  for candidate in "$@"; do
    if [ -x "$candidate" ]; then
      printf '%s' "$candidate"
      return 0
    fi
  done

  return 1
}

NODE_BIN="$(resolve_binary node /opt/homebrew/bin/node /usr/local/bin/node || true)"
NPM_BIN="$(resolve_binary npm /opt/homebrew/bin/npm /usr/local/bin/npm || true)"


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

git_rev_short() {
  local repo="$1"
  if [ ! -d "$repo/.git" ]; then
    return 1
  fi
  git -C "$repo" rev-parse --short HEAD 2>/dev/null
}

manifest_get() {
  local file="$1"
  local json_path="$2"
  python3 - "$file" "$json_path" <<'PY'
import json
import sys

manifest = sys.argv[1]
path = sys.argv[2].split(".")

try:
    with open(manifest, "r", encoding="utf-8") as f:
        data = json.load(f)
    value = data
    for key in path:
        value = value[key]
except Exception:
    sys.exit(1)

if isinstance(value, bool):
    print("true" if value else "false")
elif value is None:
    print("")
else:
    print(str(value))
PY
}

build_mode_from_env() {
  local mode="${STACK_MY_ARCH_AUTO_REBUILD_MODE:-fast}"
  case "$mode" in
    strict|fast)
      printf '%s' "$mode"
      ;;
    *)
      echo "⚠️ STACK_MY_ARCH_AUTO_REBUILD_MODE inválido: '$mode'. Usando 'fast'."
      printf '%s' "fast"
      ;;
  esac
}

needs_auto_rebuild() {
  local reasons=()

  if [ "${STACK_MY_ARCH_FORCE_REBUILD:-0}" = "1" ]; then
    reasons+=("STACK_MY_ARCH_FORCE_REBUILD=1")
  fi

  if [ ! -f "$MANIFEST_FILE" ]; then
    reasons+=("falta build manifest en $MANIFEST_FILE")
  else
    local manifest_hub manifest_ios manifest_android manifest_sdd
    manifest_hub="$(manifest_get "$MANIFEST_FILE" "hub.commit" || true)"
    manifest_ios="$(manifest_get "$MANIFEST_FILE" "courses.ios.repoCommit" || true)"
    manifest_android="$(manifest_get "$MANIFEST_FILE" "courses.android.repoCommit" || true)"
    manifest_sdd="$(manifest_get "$MANIFEST_FILE" "courses.sdd.repoCommit" || true)"

    local current_hub current_ios current_android current_sdd
    current_hub="$(git_rev_short "$HUB_ROOT" || true)"
    current_ios="$(git_rev_short "$IOS_REPO" || true)"
    current_android="$(git_rev_short "$ANDROID_REPO" || true)"
    current_sdd="$(git_rev_short "$SDD_REPO" || true)"

    if [ -z "$manifest_hub" ] || [ -z "$manifest_ios" ] || [ -z "$manifest_android" ] || [ -z "$manifest_sdd" ]; then
      reasons+=("manifest incompleto o no parseable")
    fi

    if [ -z "$current_hub" ] || [ -z "$current_ios" ] || [ -z "$current_android" ] || [ -z "$current_sdd" ]; then
      reasons+=("no se pudieron resolver commits actuales de uno o más repos")
    fi

    if [ -n "$manifest_hub" ] && [ -n "$current_hub" ] && [ "$manifest_hub" != "$current_hub" ]; then
      reasons+=("hub commit cambió ($manifest_hub -> $current_hub)")
    fi
    if [ -n "$manifest_ios" ] && [ -n "$current_ios" ] && [ "$manifest_ios" != "$current_ios" ]; then
      reasons+=("ios commit cambió ($manifest_ios -> $current_ios)")
    fi
    if [ -n "$manifest_android" ] && [ -n "$current_android" ] && [ "$manifest_android" != "$current_android" ]; then
      reasons+=("android commit cambió ($manifest_android -> $current_android)")
    fi
    if [ -n "$manifest_sdd" ] && [ -n "$current_sdd" ] && [ "$manifest_sdd" != "$current_sdd" ]; then
      reasons+=("sdd commit cambió ($manifest_sdd -> $current_sdd)")
    fi
  fi

  if [ "${#reasons[@]}" -eq 0 ]; then
    return 1
  fi

  local reason
  for reason in "${reasons[@]}"; do
    echo "$reason"
  done
  return 0
}

auto_rebuild_if_stale() {
  if [ "${STACK_MY_ARCH_SKIP_AUTO_REBUILD:-0}" = "1" ]; then
    echo "ℹ️ Auto-rebuild desactivado por STACK_MY_ARCH_SKIP_AUTO_REBUILD=1"
    return 0
  fi

  if [ ! -x "$BUILD_SCRIPT" ]; then
    echo "⚠️ No se encontró script de build ejecutable en $BUILD_SCRIPT. Continúo sin auto-rebuild."
    return 0
  fi

  local rebuild_reasons
  rebuild_reasons="$(needs_auto_rebuild || true)"
  if [ -z "$rebuild_reasons" ]; then
    echo "✅ Contenido del hub al día (manifest + commits)."
    return 0
  fi

  local mode
  mode="$(build_mode_from_env)"
  echo "🔄 Detectado contenido stale: ejecutando rebuild automático (mode=$mode)..."
  while IFS= read -r line; do
    if [ -n "$line" ]; then
      echo "   - $line"
    fi
  done <<< "$rebuild_reasons"

  if ! "$BUILD_SCRIPT" --mode "$mode"; then
    echo "❌ Falló el rebuild automático del hub."
    echo "Puedes desactivarlo temporalmente con STACK_MY_ARCH_SKIP_AUTO_REBUILD=1."
    return 1
  fi

  echo "✅ Rebuild automático completado."
}

is_port_listening() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

health_ok() {
  local port="$1"
  local health_payload
  health_payload="$(curl -fsS "http://127.0.0.1:${port}/health" 2>/dev/null || true)"
  if [ -z "$health_payload" ]; then
    return 1
  fi

  if [[ "$health_payload" != *'"ok":true'* ]] || [[ "$health_payload" != *'"service":"assistant-bridge"'* ]]; then
    return 1
  fi

  curl -fsS "http://127.0.0.1:${port}/index.html" >/dev/null 2>&1
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

existing_hub_port() {
  if [ ! -f "$PID_FILE" ] || [ ! -f "$PORT_FILE" ]; then
    return 1
  fi

  local pid
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -z "$pid" ] || ! [[ "$pid" =~ ^[0-9]+$ ]]; then
    return 1
  fi

  if ! kill -0 "$pid" >/dev/null 2>&1; then
    return 1
  fi

  local port
  port="$(cat "$PORT_FILE" 2>/dev/null || true)"
  if [ -z "$port" ] || ! [[ "$port" =~ ^[0-9]+$ ]]; then
    return 1
  fi

  if health_ok "$port"; then
    echo "$port"
    return 0
  fi

  return 1
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

  if [ -z "$NODE_BIN" ]; then
    echo "❌ No se encontró node en PATH (entorno de app sin Homebrew)."
    return 1
  fi

  if [ ! -d node_modules ]; then
    if [ -z "$NPM_BIN" ]; then
      echo "❌ No se encontró npm para instalar dependencias iniciales."
      return 1
    fi

    echo "📦 Instalando dependencias (primera vez)..."
    "$NPM_BIN" install --silent
  fi

  : > "$LOG_FILE"
  PORT="$port" OPENAI_API_KEY="$api_key" nohup "$NODE_BIN" server.js >>"$LOG_FILE" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_FILE"
  echo "$port" > "$PORT_FILE"

  if ! wait_health "$port" 25; then
    echo "❌ El servidor no respondió en el puerto $port."
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
    rm -f "$PID_FILE" "$PORT_FILE"
    return 1
  fi
}

open_url_with_fallback() {
  local url="$1"
  local ts
  ts="$(/bin/date '+%Y-%m-%d %H:%M:%S')"

  # Prefer explicit browsers to guarantee foreground focus.
  if /usr/bin/open -a "Google Chrome" "$url" >/dev/null 2>&1; then
    echo "[$ts] browser_open: explicit app ok -> Google Chrome" >>"$LOG_FILE"
    return 0
  fi

  if /usr/bin/open -a "Safari" "$url" >/dev/null 2>&1; then
    echo "[$ts] browser_open: explicit app ok -> Safari" >>"$LOG_FILE"
    return 0
  fi

  if /usr/bin/open -a "Comet" "$url" >/dev/null 2>&1; then
    echo "[$ts] browser_open: explicit app ok -> Comet" >>"$LOG_FILE"
    return 0
  fi

  if /usr/bin/open "$url" >/dev/null 2>&1; then
    echo "[$ts] browser_open: default open ok" >>"$LOG_FILE"
    return 0
  fi

  if /usr/bin/osascript - "$url" <<'APPLESCRIPT' >/dev/null 2>&1
on run argv
  set targetUrl to item 1 of argv
  open location targetUrl
end run
APPLESCRIPT
  then
    echo "[$ts] browser_open: osascript open location ok" >>"$LOG_FILE"
    return 0
  fi

  echo "[$ts] browser_open: failed all methods" >>"$LOG_FILE"
  return 1
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

  local cache_bust
  cache_bust="$(/bin/date +%s)"
  local separator="?"
  if [[ "$path" == *"?"* ]]; then
    separator="&"
  fi

  local url="http://127.0.0.1:${port}${path}${separator}_cb=${cache_bust}"
  if ! open_url_with_fallback "$url"; then
    echo "⚠️ No se pudo abrir navegador automáticamente. URL: $url"
  fi
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

  auto_rebuild_if_stale

  local running_port
  running_port="$(existing_hub_port || true)"
  if [ -n "$running_port" ]; then
    echo "ℹ️ Hub ya activo en puerto $running_port (instancia existente)."
    open_course "$running_port" "$course"
    exit 0
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

  local api_key
  api_key="$(resolve_api_key || true)"
  if [ -z "$api_key" ]; then
    echo "⚠️ OPENAI_API_KEY no está configurada: el hub arrancará sin chat IA."
  fi

  echo "🚀 Arrancando Hub + proxy en puerto $port ..."
  start_server "$port" "$api_key"
  open_course "$port" "$course"
  echo "📝 Log: $LOG_FILE"
}

main "$@"
