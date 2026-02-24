#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LAUNCH_SCRIPT="$SCRIPT_DIR/launch-hub.sh"
STOP_SCRIPT="$SCRIPT_DIR/stop-hub.sh"
RUNTIME_DIR="$SCRIPT_DIR/../.runtime"
PID_FILE="$RUNTIME_DIR/hub.pid"
PORT_FILE="$RUNTIME_DIR/hub.port"
LOCK_DIR="$RUNTIME_DIR/toggle.lock"

notify() {
  local title="$1"
  local message="$2"
  if command -v osascript >/dev/null 2>&1; then
    osascript - "$title" "$message" <<'APPLESCRIPT' >/dev/null 2>&1
on run argv
  set notifTitle to item 1 of argv
  set notifMessage to item 2 of argv
  display notification notifMessage with title notifTitle
end run
APPLESCRIPT
  fi
}

acquire_lock() {
  mkdir -p "$RUNTIME_DIR"

  if mkdir "$LOCK_DIR" 2>/dev/null; then
    /bin/date +%s > "$LOCK_DIR/ts"
    trap 'rm -rf "$LOCK_DIR" >/dev/null 2>&1 || true' EXIT INT TERM HUP
    return 0
  fi

  local now lock_ts age
  now="$(/bin/date +%s)"
  lock_ts="$(cat "$LOCK_DIR/ts" 2>/dev/null || echo 0)"

  if [[ "$lock_ts" =~ ^[0-9]+$ ]]; then
    age=$((now - lock_ts))
    if [ "$age" -gt 30 ]; then
      rm -rf "$LOCK_DIR" >/dev/null 2>&1 || true
      if mkdir "$LOCK_DIR" 2>/dev/null; then
        /bin/date +%s > "$LOCK_DIR/ts"
        trap 'rm -rf "$LOCK_DIR" >/dev/null 2>&1 || true' EXIT INT TERM HUP
        return 0
      fi
    fi
  fi

  return 1
}

port_is_healthy() {
  local port="$1"
  if [[ ! "$port" =~ ^[0-9]+$ ]]; then
    return 1
  fi
  curl -fsS "http://127.0.0.1:${port}/health" >/dev/null 2>&1
}

is_hub_running() {
  if [ -f "$PID_FILE" ] && [ -f "$PORT_FILE" ]; then
    local pid port
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    port="$(cat "$PORT_FILE" 2>/dev/null || true)"
    if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" >/dev/null 2>&1 && port_is_healthy "$port"; then
      return 0
    fi
  fi

  if [ -f "$PORT_FILE" ]; then
    local remembered_port
    remembered_port="$(cat "$PORT_FILE" 2>/dev/null || true)"
    if port_is_healthy "$remembered_port"; then
      return 0
    fi
  fi

  return 1
}

run_and_capture() {
  set +e
  local output
  output="$("$@" 2>&1)"
  local rc=$?
  set -e
  printf '%s\n' "$output"
  return "$rc"
}

main() {
  local course="${1:-hub}"

  if ! acquire_lock; then
    # Ignore duplicated concurrent launches from Dock/Finder.
    exit 0
  fi

  if is_hub_running; then
    if run_and_capture /bin/zsh -f "$STOP_SCRIPT"; then
      notify "Stack My Architecture Hub" "Se ha cerrado el hub."
      exit 0
    fi

    notify "Stack My Architecture Hub" "No se ha podido cerrar el hub."
    exit 1
  fi

  if run_and_capture /bin/zsh -f "$LAUNCH_SCRIPT" "$course"; then
    notify "Stack My Architecture Hub" "Se ha arrancado el hub."
    exit 0
  fi

  notify "Stack My Architecture Hub" "No se ha podido arrancar el hub."
  exit 1
}

main "$@"
