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

run_doctor() {
  say_title "Paso 1/4: Doctor"
  if /bin/zsh -f "$DOCTOR_SCRIPT"; then
    say_ok "Doctor completado."
  else
    say_fail "Doctor falló."
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
      return 0
    fi
    say_fail "No hay snapshots para verificar. Ejecuta: stack-hub --backup-runtime"
    return 1
  fi

  if /bin/zsh -f "$SNAPSHOT_SCRIPT" verify "$latest"; then
    say_ok "Snapshot verificado: $latest"
  else
    say_fail "Falló verificación del snapshot latest."
  fi
}

run_selftest() {
  say_title "Paso 3/4: Selftest"
  case "$SELFTEST_MODE" in
    strict)
      if /bin/zsh -f "$SELFTEST_SCRIPT" --strict; then
        say_ok "Selftest strict completado."
      else
        say_fail "Selftest strict falló."
      fi
      ;;
    basic)
      if /bin/zsh -f "$SELFTEST_SCRIPT"; then
        say_ok "Selftest básico completado."
      else
        say_fail "Selftest básico falló."
      fi
      ;;
    off)
      say_warn "Selftest omitido por STACK_MY_ARCH_AUDIT_SELFTEST=off."
      ;;
    *)
      say_fail "Valor inválido STACK_MY_ARCH_AUDIT_SELFTEST='$SELFTEST_MODE' (usa strict|basic|off)."
      ;;
  esac
}

run_status() {
  say_title "Paso 4/4: Status final"
  if /bin/zsh -f "$STATUS_SCRIPT"; then
    say_ok "Status final ejecutado."
  else
    say_fail "Status final falló."
  fi
}

main() {
  echo "=== stack-hub audit-all ==="
  echo "Hub root: $HUB_ROOT"
  echo "SELFTEST_MODE=$SELFTEST_MODE"
  echo "ALLOW_NO_SNAPSHOT=$ALLOW_NO_SNAPSHOT"

  run_doctor
  run_verify_latest_snapshot
  run_selftest
  run_status

  echo ""
  echo "=== Resumen audit-all ==="
  echo "OK: $ok_count"
  echo "WARN: $warn_count"
  echo "FAIL: $fail_count"

  if [ "$fail_count" -gt 0 ]; then
    exit 1
  fi
  exit 0
}

main "$@"
