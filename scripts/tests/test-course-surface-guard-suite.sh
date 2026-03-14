#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SURFACE_GUARD_SCRIPT="$HUB_ROOT/scripts/validate-course-surface-guard.sh"

output="$($SURFACE_GUARD_SCRIPT 2>&1)"
echo "$output"

echo "$output" | rg -q "Guardas anti-regresión de superficie en verde."

echo "[PASS] course surface guard suite"
