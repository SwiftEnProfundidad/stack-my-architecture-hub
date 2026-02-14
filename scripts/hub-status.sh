#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="$HUB_ROOT/.runtime"
PID_FILE="$RUNTIME_DIR/hub.pid"
PORT_FILE="$RUNTIME_DIR/hub.port"
LOG_FILE="$RUNTIME_DIR/hub.log"
MANIFEST_FILE="$RUNTIME_DIR/build-manifest.json"

echo "Hub root: $HUB_ROOT"
echo "Runtime: $RUNTIME_DIR"

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
  echo "Proceso: activo (pid=$pid)"
  if [ -n "$cmd" ]; then
    echo "Comando: $cmd"
  fi
else
  echo "Proceso: inactivo"
fi

if [ -n "$port" ] && [[ "$port" =~ ^[0-9]+$ ]]; then
  echo "Puerto recordado: $port"
  if curl -fsS "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
    echo "Health 127.0.0.1:$port: OK"
  else
    echo "Health 127.0.0.1:$port: FAIL"
  fi
else
  echo "Puerto recordado: (vacío)"
fi

if [ -f "$MANIFEST_FILE" ]; then
  echo "Manifest: $MANIFEST_FILE"
  python3 - "$MANIFEST_FILE" <<'PY'
import json
import sys

manifest_file = sys.argv[1]
with open(manifest_file, "r", encoding="utf-8") as f:
    m = json.load(f)

print(f"  generatedAtUtc: {m.get('generatedAtUtc', '')}")
print(f"  mode: {m.get('mode', '')}")
g = m.get("gates", {})
print(f"  gates.sddFullAuditRan: {g.get('sddFullAuditRan', False)}")
print(f"  gates.runtimeSmokeRan: {g.get('runtimeSmokeRan', False)}")
h = m.get("hub", {})
print(f"  hub.commit: {h.get('commit', '')}")
c = m.get("courses", {})
for key in ("ios", "android", "sdd"):
    entry = c.get(key, {})
    print(f"  {key}.repoCommit: {entry.get('repoCommit', '')}")
PY
else
  echo "Manifest: no encontrado ($MANIFEST_FILE)"
fi

echo "Log: $LOG_FILE"
