#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
STAMP_SCRIPT="$HUB_ROOT/scripts/stamp-asset-version.py"

TMP_DIR="$(mktemp -d)"
FIXTURE_ROOT="$TMP_DIR/hub-fixture"
TARGET_HTML="$FIXTURE_ROOT/ios/index.html"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p \
  "$FIXTURE_ROOT/ios/assets" \
  "$FIXTURE_ROOT/android/assets" \
  "$FIXTURE_ROOT/sdd/assets"

cat >"$TARGET_HTML" <<'EOF'
<!doctype html>
<html lang="es">
  <head>
    <link rel="stylesheet" href="./assets/study-ux.css?v=legacy" />
    <script src="./assets/study-ux.js?v=legacy"></script>
  </head>
  <body></body>
</html>
EOF

cat >"$FIXTURE_ROOT/ios/assets/study-ux.css" <<'EOF'
body { color: #fff; }
EOF

cat >"$FIXTURE_ROOT/ios/assets/study-ux.js" <<'EOF'
console.log('ios');
EOF

cat >"$FIXTURE_ROOT/android/assets/study-ux.css" <<'EOF'
body { color: #0ff; }
EOF

cat >"$FIXTURE_ROOT/sdd/assets/study-ux.js" <<'EOF'
console.log('sdd');
EOF

extract_version() {
  TARGET_PATH="$1" python3 - <<'PY'
import os
import re
from pathlib import Path

content = Path(os.environ["TARGET_PATH"]).read_text(encoding="utf-8")
match = re.search(r"\?v=([A-Za-z0-9._-]+)", content)
if not match:
    raise SystemExit("version marker not found")
print(match.group(1))
PY
}

python3 "$STAMP_SCRIPT" --hub-root "$FIXTURE_ROOT" --target "ios/index.html" >/dev/null
version_one="$(extract_version "$TARGET_HTML")"

python3 "$STAMP_SCRIPT" --hub-root "$FIXTURE_ROOT" --target "ios/index.html" >/dev/null
version_two="$(extract_version "$TARGET_HTML")"

if [[ "$version_one" != "$version_two" ]]; then
  echo "[FAIL] deterministic stamp changed without asset changes: $version_one != $version_two"
  exit 1
fi

cat >"$FIXTURE_ROOT/android/assets/study-ux.css" <<'EOF'
body { color: #f80; }
EOF

python3 "$STAMP_SCRIPT" --hub-root "$FIXTURE_ROOT" --target "ios/index.html" >/dev/null
version_three="$(extract_version "$TARGET_HTML")"

if [[ "$version_three" == "$version_two" ]]; then
  echo "[FAIL] deterministic stamp did not change after asset content change"
  exit 1
fi

echo "[PASS] stamp-asset-version is deterministic and content-based"
