#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${1:-https://architecture-stack.vercel.app}"

if ! command -v curl >/dev/null 2>&1; then
  echo "[ERROR] curl no esta disponible en PATH."
  exit 1
fi

fetch_page() {
  local path="$1"
  local out="$2"
  local code
  code="$(curl -sS -L -o "$out" -w "%{http_code}" "${BASE_URL}${path}" || true)"
  if [[ "$code" != "200" ]]; then
    echo "[FAIL] ${BASE_URL}${path} -> ${code}"
    return 1
  fi
  if ! grep -qi "<html" "$out"; then
    echo "[FAIL] ${BASE_URL}${path} -> 200 pero respuesta no parece HTML"
    return 1
  fi
  echo "[OK] ${BASE_URL}${path} -> ${code}"
  return 0
}

assert_contains() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if ! grep -Eq "$pattern" "$file"; then
    echo "[FAIL] Falta '${label}'"
    return 1
  fi
  echo "[OK] ${label}"
  return 0
}

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

hub_html="$tmp_dir/hub.html"
auth_index_html="$tmp_dir/auth-index.html"
auth_login_html="$tmp_dir/auth-login.html"
ios_html="$tmp_dir/ios.html"
android_html="$tmp_dir/android.html"
sdd_html="$tmp_dir/sdd.html"

echo "[SMOKE-FUNCIONAL] Base URL: ${BASE_URL}"

fetch_page "/" "$hub_html"
fetch_page "/auth/index.html" "$auth_index_html"
fetch_page "/auth/login.html" "$auth_login_html"
fetch_page "/ios/index.html" "$ios_html"
fetch_page "/android/index.html" "$android_html"
fetch_page "/sdd/index.html" "$sdd_html"

echo "[SMOKE-FUNCIONAL] Validando Hub landing..."
assert_contains "$hub_html" 'href="\./ios/index\.html"' "Hub -> enlace curso iOS"
assert_contains "$hub_html" 'href="\./android/index\.html"' "Hub -> enlace curso Android"
assert_contains "$hub_html" 'href="\./sdd/index\.html"' "Hub -> enlace curso IA + SDD"
assert_contains "$hub_html" 'href="\./auth/index\.html"' "Hub -> enlace cuenta y sincronización"
assert_contains "$hub_html" 'href="\./auth/login\.html"' "Hub -> enlace login"

echo "[SMOKE-FUNCIONAL] Validando Auth..."
assert_contains "$auth_index_html" 'Crear cuenta' "Auth index -> crear cuenta"
assert_contains "$auth_index_html" 'Iniciar sesión' "Auth index -> iniciar sesión"
assert_contains "$auth_index_html" 'Recuperar contraseña' "Auth index -> recuperar contraseña"
assert_contains "$auth_index_html" 'Volver al hub' "Auth index -> volver al hub"
assert_contains "$auth_login_html" 'id="login-form"' "Auth login -> formulario login"
assert_contains "$auth_login_html" 'id="logout-btn"' "Auth login -> botón logout"
assert_contains "$auth_login_html" 'window\.SMAAuth' "Auth login -> runtime auth client"

echo "[SMOKE-FUNCIONAL] Validando cursos publicados..."
for file in "$ios_html" "$android_html" "$sdd_html"; do
  assert_contains "$file" 'id="study-ux-controls"' "Curso -> controles de estudio"
  assert_contains "$file" 'id="course-switcher-menu"' "Curso -> menu de selector de cursos"
  assert_contains "$file" 'data-lesson-path="' "Curso -> enlaces de lecciones"
  assert_contains "$file" 'course-switcher\.js' "Curso -> script course-switcher"
  assert_contains "$file" 'assistant-bridge\.js' "Curso -> script assistant-bridge"
done

echo "[SMOKE-FUNCIONAL] Smoke funcional público completado correctamente."
