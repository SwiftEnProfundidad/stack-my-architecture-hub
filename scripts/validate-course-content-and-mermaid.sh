#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE_ROOT="$(cd "$HUB_ROOT/.." && pwd)"
MERMAID_RUNTIME_VALIDATOR="$SCRIPT_DIR/validate-hub-mermaid-runtime.mjs"

IOS_ROOT="$WORKSPACE_ROOT/stack-my-architecture-ios"
ANDROID_ROOT="$WORKSPACE_ROOT/stack-my-architecture-android"
SDD_ROOT="$WORKSPACE_ROOT/stack-my-architecture-SDD/stack-my-architecture-SDD"

require_path() {
  local label="$1"
  local target="$2"
  if [[ ! -e "$target" ]]; then
    echo "[COURSE-QA] ERROR: falta $label -> $target"
    exit 1
  fi
}

run_check() {
  local label="$1"
  shift
  echo "[COURSE-QA] -> $label"
  "$@"
}

require_path "repo iOS" "$IOS_ROOT"
require_path "repo Android" "$ANDROID_ROOT"
require_path "repo SDD" "$SDD_ROOT"
require_path "validator runtime Mermaid" "$MERMAID_RUNTIME_VALIDATOR"

run_check "iOS learning gates" python3 "$IOS_ROOT/scripts/validate-learning-gates.py"
run_check "iOS Mermaid semantics" python3 "$IOS_ROOT/scripts/validate-diagram-semantics.py"
run_check "Android learning gates" python3 "$ANDROID_ROOT/scripts/validate-learning-gates.py"
run_check "Android Mermaid semantics" python3 "$ANDROID_ROOT/scripts/validate-diagram-semantics.py"
run_check "SDD learning gates" python3 "$SDD_ROOT/scripts/validate-learning-gates.py"
run_check "SDD Mermaid semantics" python3 "$SDD_ROOT/scripts/validate-diagram-semantics.py"
run_check "SDD pedagogy" python3 "$SDD_ROOT/scripts/validate-pedagogy.py"
run_check "Hub Mermaid runtime + SVG legends" node "$MERMAID_RUNTIME_VALIDATOR"

echo "[COURSE-QA] Suite de contenido curricular y Mermaid en verde."
