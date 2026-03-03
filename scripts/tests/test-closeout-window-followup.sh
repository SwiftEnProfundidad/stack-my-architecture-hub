#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FOLLOWUP_SCRIPT="$HUB_ROOT/scripts/closeout-window-followup.sh"

TMP_DIR="$(mktemp -d)"
RUNTIME_DIR="$TMP_DIR/runtime"
LOG_FILE="$TMP_DIR/followup.log"
LOG_FILE_2="$TMP_DIR/followup-no-flag.log"
AUTO_STATUS="$RUNTIME_DIR/auto-closeout-status.env"
DEPLOY_STATUS="$RUNTIME_DIR/deploy-and-verify-last.env"
FLAG_FILE="$RUNTIME_DIR/closeout-complete.flag"
mkdir -p "$RUNTIME_DIR"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

cat >"$TMP_DIR/fake-atq.sh" <<'EOF'
#!/usr/bin/env bash
echo "42 Tue Mar 3 16:08:00 2026"
exit 0
EOF

cat >"$TMP_DIR/fake-status.sh" <<'EOF'
#!/usr/bin/env bash
echo "status: cooldown activo"
exit 2
EOF

cat >"$TMP_DIR/fake-readiness.sh" <<'EOF'
#!/usr/bin/env bash
echo "readiness: en espera"
exit 2
EOF

cat >"$TMP_DIR/fake-routes.sh" <<'EOF'
#!/usr/bin/env bash
echo "routes ok for $1"
exit 0
EOF

cat >"$TMP_DIR/fake-functional.sh" <<'EOF'
#!/usr/bin/env bash
echo "functional ok for $1"
exit 0
EOF

cat >"$TMP_DIR/fake-post-checks.sh" <<'EOF'
#!/usr/bin/env bash
echo "post-checks ok for $1"
exit 0
EOF

cat >"$TMP_DIR/fake-freeze-check.sh" <<'EOF'
#!/usr/bin/env bash
echo "freeze-check stub report"
exit "${FAKE_FREEZE_EXIT:-0}"
EOF

chmod +x \
  "$TMP_DIR/fake-atq.sh" \
  "$TMP_DIR/fake-status.sh" \
  "$TMP_DIR/fake-readiness.sh" \
  "$TMP_DIR/fake-routes.sh" \
  "$TMP_DIR/fake-functional.sh" \
  "$TMP_DIR/fake-post-checks.sh" \
  "$TMP_DIR/fake-freeze-check.sh"

cat >"$AUTO_STATUS" <<'EOF'
last_run_at='2026-03-03 02:07:10 CET'
last_exit_code=3
EOF

cat >"$DEPLOY_STATUS" <<'EOF'
state='success'
mode='fast'
base_url='https://architecture-stack.vercel.app'
EOF

touch "$FLAG_FILE"

assert_contains() {
  local file="$1"
  local pattern="$2"
  local msg="$3"
  if ! rg -q -- "$pattern" "$file"; then
    echo "[FAIL] $msg (pattern='$pattern')"
    echo "--- $file ---"
    cat "$file"
    exit 1
  fi
}

SMA_CLOSEOUT_RUNTIME_DIR="$RUNTIME_DIR" \
SMA_CLOSEOUT_FOLLOWUP_LOG_FILE="$LOG_FILE" \
SMA_ATQ_CMD="$TMP_DIR/fake-atq.sh" \
SMA_CLOSEOUT_STATUS_CMD="$TMP_DIR/fake-status.sh" \
SMA_CLOSEOUT_READINESS_CMD="$TMP_DIR/fake-readiness.sh" \
SMA_CLOSEOUT_AUTO_STATUS_FILE="$AUTO_STATUS" \
SMA_CLOSEOUT_DEPLOY_STATUS_FILE="$DEPLOY_STATUS" \
SMA_CLOSEOUT_COMPLETE_FLAG="$FLAG_FILE" \
SMA_CLOSEOUT_BASE_URL="https://example.test" \
SMA_CLOSEOUT_PUBLIC_ROUTES_CMD="$TMP_DIR/fake-routes.sh" \
SMA_CLOSEOUT_PUBLIC_FUNCTIONAL_CMD="$TMP_DIR/fake-functional.sh" \
SMA_CLOSEOUT_POST_DEPLOY_CHECKS_CMD="$TMP_DIR/fake-post-checks.sh" \
SMA_CLOSEOUT_FREEZE_CHECK_CMD="$TMP_DIR/fake-freeze-check.sh" \
"$FOLLOWUP_SCRIPT" >"$TMP_DIR/stdout.txt" 2>&1

assert_contains "$TMP_DIR/stdout.txt" "\\[FOLLOWUP\\] Log:" "debe imprimir path de log"
assert_contains "$LOG_FILE" "\\[FOLLOWUP\\] >>> atq" "debe ejecutar atq"
assert_contains "$LOG_FILE" "42 Tue Mar 3 16:08:00 2026" "debe volcar salida de atq"
assert_contains "$LOG_FILE" "closeout-status exit=2" "debe registrar exit code de status"
assert_contains "$LOG_FILE" "status: cooldown activo" "debe incluir salida de status"
assert_contains "$LOG_FILE" "closeout-readiness exit=2" "debe registrar exit code de readiness"
assert_contains "$LOG_FILE" "readiness: en espera" "debe incluir salida de readiness"
assert_contains "$LOG_FILE" "auto-closeout-status\\.env" "debe incluir bloque de status file"
assert_contains "$LOG_FILE" "last_exit_code=3" "debe incluir contenido de status file"
assert_contains "$LOG_FILE" "deploy-and-verify-last\\.env" "debe incluir bloque de estado del runner"
assert_contains "$LOG_FILE" "state='success'" "debe incluir estado del runner"
assert_contains "$LOG_FILE" "closeout-complete\\.flag present" "debe indicar flag presente"
assert_contains "$LOG_FILE" "\\[FOLLOWUP\\] >>> smoke-public-routes" "debe ejecutar smoke publico de rutas"
assert_contains "$LOG_FILE" "routes ok for https://example.test" "debe incluir salida de smoke de rutas"
assert_contains "$LOG_FILE" "\\[FOLLOWUP\\] >>> smoke-public-functional" "debe ejecutar smoke publico funcional"
assert_contains "$LOG_FILE" "functional ok for https://example.test" "debe incluir salida de smoke funcional"
assert_contains "$LOG_FILE" "\\[FOLLOWUP\\] >>> post-deploy-checks" "debe ejecutar post-checks"
assert_contains "$LOG_FILE" "post-checks ok for https://example.test" "debe incluir salida de post-checks"
assert_contains "$LOG_FILE" "\\[FOLLOWUP\\] >>> closeout-freeze-check" "debe ejecutar freeze-check"
assert_contains "$LOG_FILE" "freeze-check stub report" "debe incluir salida de freeze-check"
assert_contains "$LOG_FILE" "closeout-freeze-check exit=0" "debe registrar freeze-check en verde"

# Case 2: without complete flag should skip public verification commands
rm -f "$FLAG_FILE"

SMA_CLOSEOUT_RUNTIME_DIR="$RUNTIME_DIR" \
SMA_CLOSEOUT_FOLLOWUP_LOG_FILE="$LOG_FILE_2" \
SMA_ATQ_CMD="$TMP_DIR/fake-atq.sh" \
SMA_CLOSEOUT_STATUS_CMD="$TMP_DIR/fake-status.sh" \
SMA_CLOSEOUT_READINESS_CMD="$TMP_DIR/fake-readiness.sh" \
SMA_CLOSEOUT_AUTO_STATUS_FILE="$AUTO_STATUS" \
SMA_CLOSEOUT_DEPLOY_STATUS_FILE="$DEPLOY_STATUS" \
SMA_CLOSEOUT_COMPLETE_FLAG="$FLAG_FILE" \
SMA_CLOSEOUT_BASE_URL="https://example.test" \
SMA_CLOSEOUT_PUBLIC_ROUTES_CMD="$TMP_DIR/fake-routes.sh" \
SMA_CLOSEOUT_PUBLIC_FUNCTIONAL_CMD="$TMP_DIR/fake-functional.sh" \
SMA_CLOSEOUT_POST_DEPLOY_CHECKS_CMD="$TMP_DIR/fake-post-checks.sh" \
SMA_CLOSEOUT_FREEZE_CHECK_CMD="$TMP_DIR/fake-freeze-check.sh" \
FAKE_FREEZE_EXIT=2 \
"$FOLLOWUP_SCRIPT" >"$TMP_DIR/stdout2.txt" 2>&1

assert_contains "$LOG_FILE_2" "closeout-complete\\.flag absent" "debe indicar flag ausente"
assert_contains "$LOG_FILE_2" "skip public verification" "debe indicar skip de verificacion publica"
assert_contains "$LOG_FILE_2" "\\[FOLLOWUP\\] >>> closeout-freeze-check" "debe ejecutar freeze-check tambien sin flag"
assert_contains "$LOG_FILE_2" "closeout-freeze-check exit=2" "debe registrar freeze-check no-ready"

echo "[PASS] closeout-window-followup tests"
