#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ROUTES_SCRIPT="$HUB_ROOT/scripts/smoke-public-routes.sh"
FUNCTIONAL_SCRIPT="$HUB_ROOT/scripts/smoke-public-functional.sh"
POST_DEPLOY_SCRIPT="$HUB_ROOT/scripts/post-deploy-checks.sh"

TMP_DIR="$(mktemp -d)"
SITE_DIR="$TMP_DIR/site"
LOG_DIR="$TMP_DIR/logs"
PORT="$(python3 - <<'PY'
import socket
s = socket.socket()
s.bind(("127.0.0.1", 0))
print(s.getsockname()[1])
s.close()
PY
)"
SERVER_PID=""

cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$SITE_DIR/auth" "$SITE_DIR/ios" "$SITE_DIR/android" "$SITE_DIR/sdd" "$LOG_DIR"

cat >"$SITE_DIR/index.html" <<'EOF'
<!doctype html>
<html lang="es">
  <body>
    <a href="./ios/index.html">iOS</a>
    <a href="./android/index.html">Android</a>
    <a href="./sdd/index.html">SDD</a>
    <script>
      function buildLoginUrl() {
        return './auth/login.html'
      }
    </script>
  </body>
</html>
EOF

cat >"$SITE_DIR/auth/index.html" <<'EOF'
<!doctype html>
<html lang="es">
  <body>
    <a id="auth-nav-register" href="./register.html">Crear cuenta</a>
    <a id="auth-nav-login" href="./login.html">Iniciar sesión</a>
    <a id="auth-nav-recover" href="./recover.html">Recuperar contraseña</a>
    <a id="auth-nav-home" href="../index.html">Volver al hub</a>
  </body>
</html>
EOF

cat >"$SITE_DIR/auth/login.html" <<'EOF'
<!doctype html>
<html lang="es">
  <body>
    <form id="login-form"></form>
    <button id="logout-btn" type="button">Cerrar sesión</button>
    <script>
      window.SMAAuth = {}
    </script>
  </body>
</html>
EOF

for course in ios android sdd; do
  cat >"$SITE_DIR/$course/index.html" <<'EOF'
<!doctype html>
<html lang="es">
  <body>
    <div id="study-ux-controls"></div>
    <div id="course-switcher-menu"></div>
    <a data-lesson-path="sample/lesson.md" href="#lesson">Lesson</a>
    <script src="./assets/course-switcher.js"></script>
    <script src="./assets/assistant-bridge.js"></script>
  </body>
</html>
EOF
done

cd "$SITE_DIR"
python3 -m http.server "$PORT" >"$LOG_DIR/server.log" 2>&1 &
SERVER_PID="$!"
sleep 1

BASE_URL="http://127.0.0.1:$PORT/"

"$ROUTES_SCRIPT" "$BASE_URL" >"$LOG_DIR/routes.out"
"$FUNCTIONAL_SCRIPT" "$BASE_URL" >"$LOG_DIR/functional.out"
"$POST_DEPLOY_SCRIPT" "$BASE_URL" >"$LOG_DIR/post-deploy.out"

grep -q "Todas las rutas publicas responden correctamente" "$LOG_DIR/routes.out"
grep -q "Smoke funcional público completado correctamente" "$LOG_DIR/functional.out"
grep -q "Verificación completa en verde" "$LOG_DIR/post-deploy.out"

echo "[PASS] public smoke suite"
