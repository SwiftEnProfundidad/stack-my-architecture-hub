#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CLI_SCRIPT="$SCRIPT_DIR/stack-hub-cli.sh"
STOP_SCRIPT="$SCRIPT_DIR/stop-hub.sh"

DESKTOP_DIR="$HOME/Desktop"
LAUNCH_APP="$DESKTOP_DIR/Stack My Architecture Hub.app"
STOP_APP="$DESKTOP_DIR/Stop Stack My Architecture Hub.app"

mkdir -p "$DESKTOP_DIR"
chmod +x "$CLI_SCRIPT" "$STOP_SCRIPT"

if command -v osacompile >/dev/null 2>&1; then
  TMP_LAUNCH="$(mktemp /tmp/sma-launch-XXXX.applescript)"
  TMP_STOP="$(mktemp /tmp/sma-stop-XXXX.applescript)"

  cat >"$TMP_LAUNCH" <<EOF
on run
  try
    do shell script "/bin/zsh -f " & quoted form of "$CLI_SCRIPT"
  on error errMsg number errNum
    display alert "Stack My Architecture Hub" message errMsg as critical
  end try
end run
EOF

  cat >"$TMP_STOP" <<EOF
on run
  try
    do shell script "/bin/zsh -f " & quoted form of "$STOP_SCRIPT"
  on error errMsg number errNum
    display alert "Stop Stack My Architecture Hub" message errMsg as critical
  end try
end run
EOF

  rm -rf "$LAUNCH_APP" "$STOP_APP"
  osacompile -o "$LAUNCH_APP" "$TMP_LAUNCH"
  osacompile -o "$STOP_APP" "$TMP_STOP"
  rm -f "$TMP_LAUNCH" "$TMP_STOP"

  echo "✅ App creada: $LAUNCH_APP"
  echo "✅ App creada: $STOP_APP"
else
  LAUNCH_CMD="$DESKTOP_DIR/Stack My Architecture Hub.command"
  STOP_CMD="$DESKTOP_DIR/Stop Stack My Architecture Hub.command"

  cat >"$LAUNCH_CMD" <<EOF
#!/bin/zsh
exec /bin/zsh -f "$CLI_SCRIPT"
EOF

  cat >"$STOP_CMD" <<EOF
#!/bin/zsh
exec /bin/zsh -f "$STOP_SCRIPT"
EOF

  chmod +x "$LAUNCH_CMD" "$STOP_CMD"
  echo "⚠️ osacompile no disponible. Se crearon .command en el Escritorio."
  echo "✅ $LAUNCH_CMD"
  echo "✅ $STOP_CMD"
fi

echo "ℹ️ Hub root: $HUB_ROOT"
