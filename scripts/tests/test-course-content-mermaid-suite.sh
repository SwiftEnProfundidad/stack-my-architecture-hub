#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SUITE_SCRIPT="$HUB_ROOT/scripts/validate-course-content-and-mermaid.sh"

output="$($SUITE_SCRIPT 2>&1)"
echo "$output"

echo "$output" | rg -q "Suite de contenido curricular y Mermaid en verde"
echo "$output" | rg -q "Hub Mermaid runtime \+ SVG legends"
echo "$output" | rg -q "\[OK\] ios: Mermaid parse="
echo "$output" | rg -q "\[OK\] android: Mermaid parse="
echo "$output" | rg -q "\[OK\] sdd: Mermaid parse="

echo "[PASS] course content and mermaid suite"
