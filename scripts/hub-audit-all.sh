#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="$HUB_ROOT/.runtime"
SNAPSHOT_DIR="$RUNTIME_DIR/snapshots"

DOCTOR_SCRIPT="$SCRIPT_DIR/hub-doctor.sh"
SELFTEST_SCRIPT="$SCRIPT_DIR/hub-selftest.sh"
SNAPSHOT_SCRIPT="$SCRIPT_DIR/runtime-snapshot.sh"
STATUS_SCRIPT="$SCRIPT_DIR/hub-status.sh"

SELFTEST_MODE="${STACK_MY_ARCH_AUDIT_SELFTEST:-strict}"        # strict|basic|off
ALLOW_NO_SNAPSHOT="${STACK_MY_ARCH_AUDIT_ALLOW_NO_SNAPSHOT:-0}" # 0|1
JSON_MODE=0
AUDIT_STARTED_AT_UTC="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
AUDIT_REPORT_JSON="$RUNTIME_DIR/audit-all-report.json"
STEPS_JSON=""

ok_count=0
warn_count=0
fail_count=0

say_title() {
  echo ""
  echo "=== $* ==="
}

say_ok() {
  ok_count=$((ok_count + 1))
  echo "✅ $*"
}

say_warn() {
  warn_count=$((warn_count + 1))
  echo "⚠️  $*"
}

say_fail() {
  fail_count=$((fail_count + 1))
  echo "❌ $*"
}

escape_json() {
  local raw="$1"
  local escaped
  escaped="${raw//\\/\\\\}"
  escaped="${escaped//\"/\\\"}"
  escaped="${escaped//$'\n'/\\n}"
  escaped="${escaped//$'\r'/\\r}"
  escaped="${escaped//$'\t'/\\t}"
  printf '%s' "$escaped"
}

append_step_json() {
  local name="$1"
  local step_status="$2"
  local detail="${3:-}"
  local item
  item="{\"name\":\"$(escape_json "$name")\",\"status\":\"$(escape_json "$step_status")\",\"detail\":\"$(escape_json "$detail")\"}"
  if [ -z "$STEPS_JSON" ]; then
    STEPS_JSON="$item"
  else
    STEPS_JSON="${STEPS_JSON},${item}"
  fi
}

run_doctor() {
  say_title "Paso 1/4: Doctor"
  if /bin/zsh -f "$DOCTOR_SCRIPT"; then
    say_ok "Doctor completado."
    append_step_json "doctor" "ok" "doctor completed"
  else
    say_fail "Doctor falló."
    append_step_json "doctor" "fail" "doctor failed"
  fi
}

run_verify_latest_snapshot() {
  say_title "Paso 2/4: Verify latest snapshot"
  mkdir -p "$SNAPSHOT_DIR"
  local latest
  latest="$(printf '%s\n' "$SNAPSHOT_DIR"/*.tar.gz(N) | sort -r | head -n 1)"

  if [ -z "$latest" ]; then
    if [ "$ALLOW_NO_SNAPSHOT" = "1" ]; then
      say_warn "No hay snapshots; permitido por STACK_MY_ARCH_AUDIT_ALLOW_NO_SNAPSHOT=1."
      append_step_json "verify_latest_snapshot" "warn" "no snapshots and allow-no-snapshot enabled"
      return 0
    fi
    say_fail "No hay snapshots para verificar. Ejecuta: stack-hub --backup-runtime"
    append_step_json "verify_latest_snapshot" "fail" "no snapshot found"
    return 1
  fi

  if /bin/zsh -f "$SNAPSHOT_SCRIPT" verify "$latest"; then
    say_ok "Snapshot verificado: $latest"
    append_step_json "verify_latest_snapshot" "ok" "$latest"
  else
    say_fail "Falló verificación del snapshot latest."
    append_step_json "verify_latest_snapshot" "fail" "$latest"
  fi
}

run_selftest() {
  say_title "Paso 3/4: Selftest"
  case "$SELFTEST_MODE" in
    strict)
      if /bin/zsh -f "$SELFTEST_SCRIPT" --strict; then
        say_ok "Selftest strict completado."
        append_step_json "selftest" "ok" "strict"
      else
        say_fail "Selftest strict falló."
        append_step_json "selftest" "fail" "strict"
      fi
      ;;
    basic)
      if /bin/zsh -f "$SELFTEST_SCRIPT"; then
        say_ok "Selftest básico completado."
        append_step_json "selftest" "ok" "basic"
      else
        say_fail "Selftest básico falló."
        append_step_json "selftest" "fail" "basic"
      fi
      ;;
    off)
      say_warn "Selftest omitido por STACK_MY_ARCH_AUDIT_SELFTEST=off."
      append_step_json "selftest" "warn" "off"
      ;;
    *)
      say_fail "Valor inválido STACK_MY_ARCH_AUDIT_SELFTEST='$SELFTEST_MODE' (usa strict|basic|off)."
      append_step_json "selftest" "fail" "invalid mode"
      ;;
  esac
}

run_status() {
  say_title "Paso 4/4: Status final"
  if /bin/zsh -f "$STATUS_SCRIPT"; then
    say_ok "Status final ejecutado."
    append_step_json "status" "ok" "status completed"
  else
    say_fail "Status final falló."
    append_step_json "status" "fail" "status failed"
  fi
}

write_json_report() {
  local final_status="ok"
  if [ "$fail_count" -gt 0 ]; then
    final_status="fail"
  fi
  mkdir -p "$RUNTIME_DIR"
  cat > "$AUDIT_REPORT_JSON" <<EOF
{
  "schemaVersion": 1,
  "generatedAtUtc": "$AUDIT_STARTED_AT_UTC",
  "hubRoot": "$(escape_json "$HUB_ROOT")",
  "selftestMode": "$(escape_json "$SELFTEST_MODE")",
  "allowNoSnapshot": $([ "$ALLOW_NO_SNAPSHOT" = "1" ] && echo true || echo false),
  "status": "$final_status",
  "counts": {
    "ok": $ok_count,
    "warn": $warn_count,
    "fail": $fail_count
  },
  "steps": [
    $STEPS_JSON
  ]
}
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --json)
        JSON_MODE=1
        shift
        ;;
      -h|--help)
        cat <<'EOF'
Uso:
  hub-audit-all.sh [--json]

Opciones:
  --json   Imprime ruta del JSON y su contenido al final.
EOF
        exit 0
        ;;
      *)
        echo "❌ Opción no reconocida: $1"
        exit 1
        ;;
    esac
  done
}

main() {
  parse_args "$@"

  echo "=== stack-hub audit-all ==="
  echo "Hub root: $HUB_ROOT"
  echo "SELFTEST_MODE=$SELFTEST_MODE"
  echo "ALLOW_NO_SNAPSHOT=$ALLOW_NO_SNAPSHOT"

  run_doctor
  run_verify_latest_snapshot
  run_selftest
  run_status

  write_json_report

  echo ""
  echo "=== Resumen audit-all ==="
  echo "OK: $ok_count"
  echo "WARN: $warn_count"
  echo "FAIL: $fail_count"

  if [ "$JSON_MODE" -eq 1 ]; then
    echo ""
    echo "=== audit-all json ==="
    echo "Path: $AUDIT_REPORT_JSON"
    cat "$AUDIT_REPORT_JSON"
  fi

  if [ "$fail_count" -gt 0 ]; then
    exit 1
  fi
  exit 0
}

main "$@"
