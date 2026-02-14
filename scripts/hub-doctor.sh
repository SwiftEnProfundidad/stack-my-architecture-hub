#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECTS_ROOT="$(cd "$HUB_ROOT/.." && pwd)"
RUNTIME_DIR="$HUB_ROOT/.runtime"
PID_FILE="$RUNTIME_DIR/hub.pid"
PORT_FILE="$RUNTIME_DIR/hub.port"
MANIFEST_FILE="$RUNTIME_DIR/build-manifest.json"
ASSISTANT_ENV="$HUB_ROOT/assistant-bridge/.env"

IOS_REPO="$PROJECTS_ROOT/stack-my-architecture-ios"
ANDROID_REPO="$PROJECTS_ROOT/stack-my-architecture-android"
SDD_REPO="$PROJECTS_ROOT/stack-my-architecture-SDD"

OK_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

say_ok() {
  OK_COUNT=$((OK_COUNT + 1))
  echo "✅ $*"
}

say_warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  echo "⚠️  $*"
}

say_fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "❌ $*"
}

check_command() {
  local cmd="$1"
  local label="$2"
  if command -v "$cmd" >/dev/null 2>&1; then
    local cmd_path
    cmd_path="$(command -v "$cmd")"
    say_ok "$label disponible: $cmd_path"
  else
    say_fail "$label no disponible en PATH."
  fi
}

check_dir() {
  local dir="$1"
  local label="$2"
  if [ -d "$dir" ]; then
    say_ok "$label existe: $dir"
  else
    say_fail "$label no existe: $dir"
  fi
}

check_file() {
  local file="$1"
  local label="$2"
  if [ -f "$file" ]; then
    say_ok "$label existe: $file"
  else
    say_fail "$label no existe: $file"
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

echo "=== stack-hub doctor ==="
echo "Hub root: $HUB_ROOT"
echo "Projects root: $PROJECTS_ROOT"
echo ""

echo "[1/8] Dependencias de entorno"
check_command zsh "zsh"
check_command git "git"
check_command python3 "python3"
check_command node "node"
check_command npm "npm"
check_command curl "curl"
if printf ':%s:' "$PATH" | grep -q ":$HOME/.local/bin:"; then
  say_ok "~/.local/bin está en PATH"
else
  say_warn "~/.local/bin no está en PATH (comando global stack-hub puede no resolverse en nuevas terminales)."
fi
echo ""

echo "[2/8] Estructura de repos y scripts"
check_dir "$HUB_ROOT" "Repo hub"
check_dir "$IOS_REPO" "Repo iOS"
check_dir "$ANDROID_REPO" "Repo Android"
check_dir "$SDD_REPO" "Repo SDD"
check_file "$HUB_ROOT/scripts/build-hub.sh" "Script build-hub"
check_file "$HUB_ROOT/scripts/launch-hub.sh" "Script launch-hub"
check_file "$HUB_ROOT/scripts/stack-hub-cli.sh" "Script stack-hub-cli"
echo ""

echo "[3/8] Runtime y permisos"
mkdir -p "$RUNTIME_DIR"
if [ -w "$RUNTIME_DIR" ]; then
  say_ok "Runtime escribible: $RUNTIME_DIR"
else
  say_fail "Runtime no escribible: $RUNTIME_DIR"
fi
if [ -f "$PID_FILE" ]; then
  say_ok "PID file presente: $PID_FILE"
else
  say_warn "PID file ausente: $PID_FILE"
fi
if [ -f "$PORT_FILE" ]; then
  say_ok "PORT file presente: $PORT_FILE"
else
  say_warn "PORT file ausente: $PORT_FILE"
fi
echo ""

echo "[4/8] API key / configuración proxy"
if [ -n "${OPENAI_API_KEY:-}" ]; then
  say_ok "OPENAI_API_KEY disponible en entorno actual"
else
  key="$(extract_key_from_file "$ASSISTANT_ENV" || true)"
  if [ -n "$key" ]; then
    say_ok "OPENAI_API_KEY encontrada en assistant-bridge/.env"
  else
    key="$(extract_key_from_file "$HOME/.zshrc" || true)"
    if [ -n "$key" ]; then
      say_ok "OPENAI_API_KEY encontrada en ~/.zshrc"
    else
      say_warn "OPENAI_API_KEY no encontrada (el hub no podrá responder consultas IA al arrancar)."
    fi
  fi
fi
echo ""

echo "[5/8] Estado del proceso hub"
pid=""
port=""
if [ -f "$PID_FILE" ]; then
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
fi
if [ -f "$PORT_FILE" ]; then
  port="$(cat "$PORT_FILE" 2>/dev/null || true)"
fi

if [ -n "$pid" ] && [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" >/dev/null 2>&1; then
  cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  say_ok "Proceso hub activo (pid=$pid)"
  if [ -n "$cmd" ]; then
    echo "    comando: $cmd"
  fi
else
  say_warn "Proceso hub inactivo o PID stale."
fi

if [ -n "$port" ] && [[ "$port" =~ ^[0-9]+$ ]]; then
  if curl -fsS "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
    say_ok "Health OK en 127.0.0.1:$port"
  else
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      say_warn "Puerto $port ocupado pero /health no responde."
    else
      say_warn "Puerto $port recordado, pero no hay listener activo."
    fi
  fi
else
  say_warn "No hay puerto recordado válido en $PORT_FILE."
fi
echo ""

echo "[6/8] Manifest y trazabilidad de publicación"
if [ -f "$MANIFEST_FILE" ]; then
  say_ok "Manifest presente: $MANIFEST_FILE"
  manifest_hub="$(manifest_get "$MANIFEST_FILE" "hub.commit" || true)"
  manifest_ios="$(manifest_get "$MANIFEST_FILE" "courses.ios.repoCommit" || true)"
  manifest_android="$(manifest_get "$MANIFEST_FILE" "courses.android.repoCommit" || true)"
  manifest_sdd="$(manifest_get "$MANIFEST_FILE" "courses.sdd.repoCommit" || true)"

  current_hub="$(git_rev_short "$HUB_ROOT" || true)"
  current_ios="$(git_rev_short "$IOS_REPO" || true)"
  current_android="$(git_rev_short "$ANDROID_REPO" || true)"
  current_sdd="$(git_rev_short "$SDD_REPO" || true)"

  stale=0
  if [ -n "$manifest_hub" ] && [ -n "$current_hub" ] && [ "$manifest_hub" != "$current_hub" ]; then
    stale=1
    echo "    - hub stale: manifest=$manifest_hub current=$current_hub"
  fi
  if [ -n "$manifest_ios" ] && [ -n "$current_ios" ] && [ "$manifest_ios" != "$current_ios" ]; then
    stale=1
    echo "    - ios stale: manifest=$manifest_ios current=$current_ios"
  fi
  if [ -n "$manifest_android" ] && [ -n "$current_android" ] && [ "$manifest_android" != "$current_android" ]; then
    stale=1
    echo "    - android stale: manifest=$manifest_android current=$current_android"
  fi
  if [ -n "$manifest_sdd" ] && [ -n "$current_sdd" ] && [ "$manifest_sdd" != "$current_sdd" ]; then
    stale=1
    echo "    - sdd stale: manifest=$manifest_sdd current=$current_sdd"
  fi

  if [ "$stale" -eq 1 ]; then
    say_warn "Manifest desactualizado respecto a commits actuales. Recomendado: stack-hub --force-rebuild"
  else
    say_ok "Manifest alineado con commits actuales."
  fi
else
  say_warn "Manifest no encontrado: $MANIFEST_FILE"
fi
echo ""

echo "[7/8] Artefactos dist básicos"
for dist in "$IOS_REPO/dist" "$ANDROID_REPO/dist" "$SDD_REPO/dist"; do
  if [ -d "$dist" ]; then
    say_ok "Dist presente: $dist"
  else
    say_warn "Dist ausente: $dist (se generará en próximo build-hub)."
  fi
done
echo ""

echo "[8/8] Resumen"
echo "OK: $OK_COUNT"
echo "WARN: $WARN_COUNT"
echo "FAIL: $FAIL_COUNT"

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
exit 0
