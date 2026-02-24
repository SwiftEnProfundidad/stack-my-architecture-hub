#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TOGGLE_SCRIPT="$SCRIPT_DIR/toggle-hub.sh"
STOP_SCRIPT="$SCRIPT_DIR/stop-hub.sh"

DESKTOP_DIR="$HOME/Desktop"
LAUNCH_APP="$DESKTOP_DIR/Stack My Architecture Hub.app"
STOP_APP="$DESKTOP_DIR/Stop Stack My Architecture Hub.app"
HUB_SHORT_APP="$DESKTOP_DIR/Hub.app"

CUSTOM_ICON="$SCRIPT_DIR/assets/hub-icon.icns"
CHATGPT_ICON="/Applications/ChatGPT.app/Contents/Resources/AppIcon.icns"
FALLBACK_ICON="/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/ToolbarCustomizeIcon.icns"

mkdir -p "$DESKTOP_DIR"
chmod +x "$TOGGLE_SCRIPT" "$STOP_SCRIPT"

resolve_icon() {
  if [ -f "$CUSTOM_ICON" ]; then
    printf '%s' "$CUSTOM_ICON"
    return 0
  fi
  if [ -f "$CHATGPT_ICON" ]; then
    printf '%s' "$CHATGPT_ICON"
    return 0
  fi
  printf '%s' "$FALLBACK_ICON"
}

create_bundle_app() {
  local app_path="$1"
  local app_name="$2"
  local bundle_id="$3"
  local target_script="$4"
  local icon_path="$5"

  rm -rf "$app_path"
  mkdir -p "$app_path/Contents/MacOS" "$app_path/Contents/Resources"

  cat >"$app_path/Contents/Info.plist" <<EOF_PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleExecutable</key>
  <string>launcher</string>
  <key>CFBundleIdentifier</key>
  <string>${bundle_id}</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>${app_name}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>CFBundleIconFile</key>
  <string>hub-icon.icns</string>
  <key>LSMinimumSystemVersion</key>
  <string>11.0</string>
</dict>
</plist>
EOF_PLIST

  cat >"$app_path/Contents/MacOS/launcher" <<EOF_LAUNCH
#!/bin/zsh
set -euo pipefail
nohup /bin/zsh -f "$target_script" >/dev/null 2>&1 &
exit 0
EOF_LAUNCH
  chmod +x "$app_path/Contents/MacOS/launcher"

  if [ -f "$icon_path" ]; then
    cp "$icon_path" "$app_path/Contents/Resources/hub-icon.icns"
  fi

  xattr -dr com.apple.quarantine "$app_path" >/dev/null 2>&1 || true
  codesign --force --deep --sign - "$app_path" >/dev/null 2>&1 || true
}

ICON_PATH="$(resolve_icon)"

create_bundle_app "$LAUNCH_APP" "Stack My Architecture Hub" "com.stackmyarchitecture.hub" "$TOGGLE_SCRIPT" "$ICON_PATH"
create_bundle_app "$STOP_APP" "Stop Stack My Architecture Hub" "com.stackmyarchitecture.hub.stop" "$STOP_SCRIPT" "$ICON_PATH"
create_bundle_app "$HUB_SHORT_APP" "Hub" "com.stackmyarchitecture.hub.short" "$TOGGLE_SCRIPT" "$ICON_PATH"

echo "✅ App creada: $LAUNCH_APP"
echo "✅ App creada: $STOP_APP"
echo "✅ App creada: $HUB_SHORT_APP"
echo "ℹ️ Hub root: $HUB_ROOT"
echo "ℹ️ Icono aplicado: $ICON_PATH"
