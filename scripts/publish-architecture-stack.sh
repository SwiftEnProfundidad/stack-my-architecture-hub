#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="${SMA_CLOSEOUT_RUNTIME_DIR:-$HUB_ROOT/.runtime}"
COOLDOWN_FILE="${SMA_CLOSEOUT_COOLDOWN_FILE:-$RUNTIME_DIR/vercel-deploy-cooldown.env}"
BUILD_SCRIPT="${SMA_PUBLISH_BUILD_SCRIPT:-$SCRIPT_DIR/build-hub.sh}"
VERIFY_CURL_BIN="${SMA_PUBLISH_CURL_BIN:-curl}"
DEPLOY_CMD="${SMA_PUBLISH_DEPLOY_CMD:-npx -y vercel deploy --prod --yes}"
FORCE_DEPLOY="${SMA_DEPLOY_FORCE:-0}"
BASE_URL="${SMA_PUBLISH_BASE_URL:-https://architecture-stack.vercel.app}"
POST_DEPLOY_FREEZE_FILE="${SMA_POST_DEPLOY_FREEZE_FILE:-$RUNTIME_DIR/post-deploy-freeze.flag}"
CLEAR_POST_DEPLOY_FREEZE="${SMA_CLEAR_POST_DEPLOY_FREEZE:-0}"
VERIFY_BASE_PERSIST_FILE="${SMA_PUBLISH_VERIFY_BASE_PERSIST_FILE:-$RUNTIME_DIR/publish-verify-base.url}"

MODE="${1:-fast}"
if [[ "$MODE" != "fast" && "$MODE" != "strict" ]]; then
  echo "Uso: $0 [fast|strict]"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "Error: python3 no esta disponible en PATH."
  exit 1
fi

mkdir -p "$RUNTIME_DIR"

load_cooldown() {
  if [[ ! -f "$COOLDOWN_FILE" ]]; then
    return 1
  fi
  # shellcheck disable=SC1090
  source "$COOLDOWN_FILE"
  return 0
}

if [[ "$FORCE_DEPLOY" != "1" ]] && load_cooldown; then
  now_epoch="$(date +%s)"
  if [[ -n "${not_before_epoch:-}" ]] && [[ "$now_epoch" -lt "$not_before_epoch" ]]; then
    remaining="$((not_before_epoch - now_epoch))"
    remaining_hours="$((remaining / 3600))"
    remaining_minutes="$(((remaining % 3600) / 60))"
    echo "[GUARD] Publicacion bloqueada por cooldown de cuota."
    echo "[GUARD] Motivo: ${reason:-api-deployments-free-per-day}"
    echo "[GUARD] Reintentar no antes de: ${not_before_local:-desconocido}"
    echo "[GUARD] Tiempo restante aproximado: ${remaining_hours}h ${remaining_minutes}m"
    echo "[GUARD] Si necesitas forzar el intento: SMA_DEPLOY_FORCE=1 $0 $MODE"
    exit 2
  fi
fi

if [[ "$CLEAR_POST_DEPLOY_FREEZE" == "1" ]]; then
  rm -f "$POST_DEPLOY_FREEZE_FILE"
fi

if [[ -f "$POST_DEPLOY_FREEZE_FILE" && "$FORCE_DEPLOY" != "1" ]]; then
  echo "[ROLLBACK] Bloqueo post-deploy activo: no se permiten más publicaciones."
  echo "[ROLLBACK] Archivo de freeze: $POST_DEPLOY_FREEZE_FILE"
  cat "$POST_DEPLOY_FREEZE_FILE" || true
  echo "[ROLLBACK] Ejecuta con SMA_CLEAR_POST_DEPLOY_FREEZE=1 o SMA_DEPLOY_FORCE=1 para reintentar tras intervención."
  exit 10
fi

if [[ -f "$POST_DEPLOY_FREEZE_FILE" && "$FORCE_DEPLOY" == "1" ]]; then
  echo "[ROLLBACK] Freeze activo detectado, se fuerza despliegue por flag de override."
  rm -f "$POST_DEPLOY_FREEZE_FILE"
fi

echo "[1/3] Building hub (mode=$MODE)..."
"$BUILD_SCRIPT" --mode "$MODE"

echo "[2/3] Deploying production to Vercel..."
set +e
DEPLOY_OUTPUT="$(cd "$HUB_ROOT" && bash -lc "$DEPLOY_CMD" 2>&1)"
DEPLOY_STATUS=$?
set -e
echo "$DEPLOY_OUTPUT"

if [[ "$DEPLOY_STATUS" -ne 0 ]]; then
  if grep -q "api-deployments-free-per-day" <<<"$DEPLOY_OUTPUT"; then
    retry_hours="$(grep -Eo 'try again in [0-9]+ hours' <<<"$DEPLOY_OUTPUT" | grep -Eo '[0-9]+' | head -1 || true)"
    if [[ -z "$retry_hours" ]]; then
      retry_hours=16
    fi
    now_epoch="$(date +%s)"
    not_before_epoch="$((now_epoch + retry_hours * 3600))"
    not_before_local="$(date -r "$not_before_epoch" '+%Y-%m-%d %H:%M:%S %Z')"
    last_error_seen_at="$(date '+%Y-%m-%d %H:%M:%S %Z')"
    {
      echo "not_before_epoch=$not_before_epoch"
      echo "not_before_local='$not_before_local'"
      echo "reason='api-deployments-free-per-day'"
      echo "last_error_seen_at='$last_error_seen_at'"
    } >"$COOLDOWN_FILE"
    echo "[GUARD] Cuota detectada. Cooldown registrado en: $COOLDOWN_FILE"
    echo "[GUARD] Próxima ventana estimada: $not_before_local"
    exit 3
  fi
  exit "$DEPLOY_STATUS"
fi

rm -f "$COOLDOWN_FILE"

VERIFY_BASE_URL="${SMA_PUBLISH_VERIFY_BASE_URL:-}"
if [[ -z "$VERIFY_BASE_URL" ]]; then
  VERIFY_BASE_URL="$(printf '%s\n' "$DEPLOY_OUTPUT" | grep -E 'Aliased: https?://' | tail -1 | sed -n 's/.*Aliased: \(https:[^ ]*\).*/\1/p' || true)"
fi
if [[ -z "$VERIFY_BASE_URL" ]]; then
  VERIFY_BASE_URL="$BASE_URL"
fi

echo "[3/3] Verifying public routes (verify base: ${VERIFY_BASE_URL})..."

for path in "/" "/ios/" "/android/" "/sdd/" "/governance/" "/pumuki/"; do
  code="$("$VERIFY_CURL_BIN" -s -o /dev/null -w "%{http_code}" "${VERIFY_BASE_URL}${path}")"
  echo "  ${VERIFY_BASE_URL}${path} -> ${code}"
  if [[ "$code" != "200" ]]; then
    echo "Error: route verification failed for ${VERIFY_BASE_URL}${path}"
    exit 1
  fi
done

printf '%s\n' "$VERIFY_BASE_URL" >"$VERIFY_BASE_PERSIST_FILE"

echo
echo "Publicado correctamente (artefacto desplegado):"
echo "  ${VERIFY_BASE_URL}"
echo "  ${VERIFY_BASE_URL}/ios/"
echo "  ${VERIFY_BASE_URL}/android/"
echo "  ${VERIFY_BASE_URL}/sdd/"
echo "  ${VERIFY_BASE_URL}/governance/"
echo "  ${VERIFY_BASE_URL}/pumuki/"
if [[ "$VERIFY_BASE_URL" != "$BASE_URL" ]]; then
  echo
  echo "Nota: dominio de comprobacion distinto de SMA_PUBLISH_BASE_URL (${BASE_URL})."
  echo "Si architecture-stack debe servir el mismo arbol estatico, sincroniza proyecto o CNAME segun tu setup."
fi
