#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DESKTOP_DIR="${STACK_MY_ARCH_DESKTOP_DIR:-$HOME/Desktop}"
APP_NAME="${STACK_MY_ARCH_HUB_APP_NAME:-Hub.app}"
APP_PATH="$DESKTOP_DIR/$APP_NAME"
CLI_SCRIPT="$HUB_ROOT/scripts/stack-hub-cli.sh"

if [[ ! -f "$CLI_SCRIPT" ]]; then
  echo "❌ No existe stack-hub-cli.sh en: $CLI_SCRIPT"
  exit 1
fi

chmod +x "$CLI_SCRIPT"

if command -v osacompile >/dev/null 2>&1; then
  TMP_SCRIPT="$(mktemp -t sma-hub-app)"
  cat >"$TMP_SCRIPT" <<EOF
on run
  try
    set cli to "$(print -r -- "$CLI_SCRIPT")"
    set prefix to "export PATH='/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'; "
    with timeout of 7200 seconds
      do shell script prefix & "/bin/zsh -f " & quoted form of cli
    end timeout
  on error errMsg number errNum
    display alert "Stack My Architecture — Hub" message errMsg as critical
  end try
end run
EOF

  rm -rf "$APP_PATH"
  osacompile -o "$APP_PATH" "$TMP_SCRIPT"
  rm -f "$TMP_SCRIPT"

  echo "✅ App (AppleScript) creada: $APP_PATH"
  echo "ℹ️  Si macOS bloquea la app: clic derecho → Abrir (primera vez)."
  echo "ℹ️  Errores de arranque se muestran en un cuadro de diálogo."
  exit 0
fi

echo "⚠️  osacompile no disponible: generando .app con launcher zsh síncrono (sin segundo plano)."

CONTENTS="$APP_PATH/Contents"
MACOS_DIR="$CONTENTS/MacOS"
RESOURCES_DIR="$CONTENTS/Resources"
LAUNCHER="$MACOS_DIR/launcher"

mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"

cat >"$CONTENTS/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleExecutable</key>
  <string>launcher</string>
  <key>CFBundleIdentifier</key>
  <string>com.stackmyarchitecture.hub.short</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>Hub</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.2</string>
  <key>CFBundleVersion</key>
  <string>3</string>
  <key>LSMinimumSystemVersion</key>
  <string>11.0</string>
</dict>
</plist>
PLIST

{
  printf '%s\n' '#!/bin/zsh'
  printf '%s\n' 'set -euo pipefail'
  printf 'HUB_ROOT=%q\n' "$HUB_ROOT"
  printf '%s\n' 'RUNTIME_DIR="$HUB_ROOT/.runtime"'
  printf '%s\n' 'LOG="$RUNTIME_DIR/desktop-hub-app.log"'
  printf '%s\n' 'CLI="$HUB_ROOT/scripts/stack-hub-cli.sh"'
  printf '%s\n' 'export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH:-/usr/bin:/bin:/usr/sbin:/sbin}"'
  printf '%s\n' 'mkdir -p "$RUNTIME_DIR"'
  printf '%s\n' 'exec >>"$LOG" 2>&1'
  printf '%s\n' 'echo ""'
  printf '%s\n' 'echo "======== $(/bin/date) pid=$$ (sync launcher) ========"'
  printf '%s\n' '[[ -f "$CLI" ]] || { echo "❌ No existe $CLI"; exit 1; }'
  printf '%s\n' 'exec /bin/zsh -f "$CLI" hub'
} >"$LAUNCHER"

chmod +x "$LAUNCHER"

echo "✅ App actualizada: $APP_PATH"
echo "ℹ️  Log: $HUB_ROOT/.runtime/desktop-hub-app.log"
