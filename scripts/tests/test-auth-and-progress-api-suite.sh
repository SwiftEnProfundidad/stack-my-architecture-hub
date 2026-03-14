#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$HUB_ROOT"

node --test scripts/tests/test-auth-sync.js
node --test scripts/tests/test-progress-sync.js
node --test scripts/tests/test-entitlements.js
node --test scripts/tests/test-admin.js
node --test scripts/tests/test-dashboard.js
node --test scripts/tests/test-student-notes.js
node --test scripts/tests/test-student-bookmarks.js
node --test scripts/tests/test-assistant-bridge-byok.js

echo "[PASS] auth and progress api suite"
