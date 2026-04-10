# Stack My Architecture Hub

Servidor local unificado para:
- contenido estático del hub (`/`, `/ios`, `/android`, `/sdd`, `/governance`, `/pumuki`)
- proxy de asistente IA (`/health`, `/config`, `/metrics`, `/assistant/query`)

## Arranque robusto recomendado

El launcher robusto evita depender de `~/.zshrc`, elige un puerto libre no genérico (prioriza `46100+`), mantiene PID y logs en `.runtime/` y abre el Hub o el curso que indiques.
Además, antes de abrir, comprueba si el hub publicado está stale (comparando `build-manifest.json` + commits actuales de `hub/ios/android/sdd`) y, si detecta cambios, lanza rebuild automático.

```bash
/Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture/stack-my-architecture-hub/open-proxy.command
```

Abrir directamente un curso:

```bash
/Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture/stack-my-architecture-hub/open-proxy.command --course sdd
/Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture/stack-my-architecture-hub/open-proxy.command ios
/Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture/stack-my-architecture-hub/open-proxy.command android
/Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture/stack-my-architecture-hub/open-proxy.command --course pumuki
```

Opcional: fijar puerto manualmente.

```bash
STACK_MY_ARCH_HUB_PORT=46200 /Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture/stack-my-architecture-hub/open-proxy.command
```

Control de auto-rebuild al arrancar:

```bash
# Modo de rebuild automático (por defecto: fast)
STACK_MY_ARCH_AUTO_REBUILD_MODE=strict /Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture/stack-my-architecture-hub/open-proxy.command

# Forzar rebuild aunque manifest+commits coincidan
STACK_MY_ARCH_FORCE_REBUILD=1 /Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture/stack-my-architecture-hub/open-proxy.command

# Saltar auto-rebuild temporalmente
STACK_MY_ARCH_SKIP_AUTO_REBUILD=1 /Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture/stack-my-architecture-hub/open-proxy.command
```

Si quieres evitar completamente llamadas manuales en terminal, crea la app de Escritorio y abre el curso con doble clic:

```bash
/bin/zsh -f /Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture/stack-my-architecture-hub/scripts/install-desktop-app.sh
```

Detener hub:

```bash
/bin/zsh -f scripts/stop-hub.sh
```

## Comando global `stack-hub` (recomendado)

Instala launcher CLI en `~/.local/bin/stack-hub`:

```bash
/bin/zsh -f /Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture/stack-my-architecture-hub/scripts/install-cli-launcher.sh
```

Uso:

```bash
stack-hub
stack-hub ios
stack-hub sdd --strict
stack-hub --course pumuki
stack-hub --course android --port 46200
stack-hub --force-rebuild
stack-hub --skip-auto-rebuild
stack-hub --status
stack-hub --doctor
stack-hub --logs
stack-hub --logs --follow
stack-hub --selftest
stack-hub --selftest --strict
stack-hub --audit-all
stack-hub --audit-all-json
stack-hub --backup-runtime
stack-hub --backup-runtime before-upgrade
stack-hub --backup-runtime --backup-runtime-keep 20
stack-hub --list-runtime-backups
stack-hub --verify-runtime-backup latest
stack-hub --restore-runtime latest
stack-hub --prune-runtime-backups 10
stack-hub ios --restart
stack-hub --stop
stack-hub --stop-force
```

Opcional para logs:

```bash
STACK_MY_ARCH_LOG_LINES=300 stack-hub --logs
```

Opcional para selftest:

```bash
STACK_MY_ARCH_SELFTEST_PORT=47650 stack-hub --selftest
```

`--selftest --strict` ejecuta además una consulta real al asistente (coste API muy bajo) para validar el ciclo extremo a extremo.

Snapshots de runtime:

```bash
stack-hub --backup-runtime
stack-hub --backup-runtime before-upgrade
stack-hub --backup-runtime --backup-runtime-keep 20
stack-hub --list-runtime-backups
stack-hub --verify-runtime-backup latest
stack-hub --restore-runtime latest
stack-hub --prune-runtime-backups 10
```

También puedes fijar auto-prune por variable de entorno:

```bash
STACK_MY_ARCH_RUNTIME_BACKUP_KEEP=20 stack-hub --backup-runtime
```

Auditoría integral en un comando:

```bash
stack-hub --audit-all
stack-hub --audit-all-json
```

Opcional:

```bash
STACK_MY_ARCH_AUDIT_SELFTEST=basic stack-hub --audit-all
STACK_MY_ARCH_AUDIT_SELFTEST=off STACK_MY_ARCH_AUDIT_ALLOW_NO_SNAPSHOT=1 stack-hub --audit-all
```

`--stop` ahora evita matar procesos ajenos si el puerto fue reutilizado por otra app.
Solo fuerza parada ciega con:

```bash
stack-hub --stop-force
```

Compatibilidad: `open-proxy.command`, `open-hub.command` y `open-hub-localhost.command` delegan internamente en el mismo CLI (`stack-hub`) para evitar rutas de arranque duplicadas.

Crear app de Escritorio (doble clic):

```bash
/bin/zsh -f scripts/install-desktop-app.sh
```

## Arranque manual (Node)

1. Exporta tu clave OpenAI:

```bash
export OPENAI_API_KEY="sk-..."
```

2. Instala dependencias:

```bash
cd assistant-bridge
npm install
```

3. Arranca el proxy + hub:

```bash
npm start
```

4. Abre el hub en el puerto elegido por el launcher (se guarda en `.runtime/hub.port`):

```bash
PORT="$(cat .runtime/hub.port)"
open "http://127.0.0.1:${PORT}/index.html"
```

También puedes usar directamente el launcher robusto:

```bash
/Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture/stack-my-architecture-hub/open-proxy.command
```

## Endpoints

```bash
PORT="$(cat .runtime/hub.port)"
curl "http://127.0.0.1:${PORT}/health"
curl "http://127.0.0.1:${PORT}/config"
curl "http://127.0.0.1:${PORT}/metrics"
```

## Persistencia cloud de progreso (opción 2)

El Hub publica dos endpoints serverless para sync de progreso de estudio:

```bash
GET  /progress/config
GET  /progress/state?courseId=...&profileKey=...
POST /progress/state
```

Si el backend no está configurado, la UX sigue funcionando con `localStorage` sin romper navegación.

### Variables de entorno requeridas (Vercel)

```bash
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
PROGRESS_SYNC_TABLE=course_progress
PROGRESS_SYNC_MAX_BYTES=65536
```

### Tabla recomendada en Supabase

Ejecuta:

```bash
docs/PROGRESS-SYNC-SUPABASE.sql
```

Esto crea la tabla `course_progress` con PK compuesta (`course_id`, `profile_key`) y bloquea acceso público (`anon/authenticated`) para que solo el backend serverless con service-role escriba/lea.

## Publicación del hub con gate SDD

Para regenerar y copiar los tres cursos al hub:

```bash
./scripts/build-hub.sh
```

### Runbook enterprise de release (manual)

Publicación controlada por workflow:
- `Hub Production Release Gate` en `.github/workflows/hub-production-release-gate.yml`.

Si **Actions no ejecuta el job** (mensaje de facturación / cuenta u org bloqueada para GitHub Actions), revisar **Billing** de la cuenta u organización; mientras tanto se puede publicar **en local** con `./scripts/publish-architecture-stack.sh strict|fast` (misma lógica de verificación de rutas y `publish-verify-base.url`).

Qué hace este gate:
- ejecuta prechecks de control (`test-public-smoke-suite`, `test-course-surface-guard-suite`, `test-stamp-asset-version`).
- ejecuta `publish-architecture-stack.sh` en modo `strict` o `fast`.
- la verificación HTTP de rutas del curso (`/`, `/ios/`, …, `/pumuki/`) usa por defecto la URL **`Aliased:`** del output de `vercel deploy` (p. ej. `https://stack-my-architecture-hub.vercel.app`); si hace falta fijarla, `SMA_PUBLISH_VERIFY_BASE_URL`. Tras un publish OK se escribe **`.runtime/publish-verify-base.url`** con esa base.
- ejecuta postchecks de producción con `post-deploy-checks.sh` usando **esa misma base** si el fichero existe (evita 404 cuando `base_url` del workflow difiere del alias real de Vercel).
- deja evidencia en artefacto `hub-release-checklist.md` y logs por run.

Paso a paso:
1. Ir a GitHub → Actions → `Hub Production Release Gate`.
2. Ejecutar `Run workflow` desde rama protegida (suele ser `develop` o `main`).
3. Elegir `mode`:
   - `strict` (recomendado por defecto, incluye audit completo de SDD).
   - `fast` (solo para casos controlados).
4. Marcar `force_deploy` solo si hay cooldown de cuota y la publicación debe forzarse.
5. Marcar `run_postchecks` si se quiere validar rutas y smoke funcional en producción.
6. (Opcional) Ajustar `base_url` para validar una URL distinta (por ejemplo staging previo).
6. Esperar aprobación del entorno `production` si la protección está activa.
7. Verificar artefacto `hub-release-evidence-<run_id>` en `Actions → Artifacts`:
   - `checklist.md`
   - logs de precheck y deploy.

Aprobadores:
- Deben existir owners con permisos de aprobación del entorno `production`.
- En caso de duda, pedir aprobación explícita al dueño de release del repo.

Criterios de aceptación del run:
- logs sin error en prechecks.
- `publish-architecture-stack.sh` finaliza `exit 0`.
- postchecks en producción finaliza `exit 0` (si se ejecutan).
- artefacto de evidencia presente y `checklist.md` con estado OK.

Criterios de rollback:
- Si la publicación falla en deploy o verificación, no cambia el estado de producción.
- Si hay regresión detectada en producción, abrir un hotfix y publicar de nuevo con `mode=fast` tras validar el fix.
- Si se necesita revertir inmediato, republishing del commit anterior (o selección directa en Vercel).
- Si el bloqueo es por `cooldown`, no forzar repetidas veces; ejecutar con `force_deploy=1` solo si aplica política aprobada.

Estado de operación:
- mantener `build-manifest.json` y checklist de evidencia para evidencia post mortem y auditoría.

Desde ahora, la publicación del curso SDD pasa por gate estricto automático:

- ejecuta `stack-my-architecture-SDD/scripts/run-full-audit.sh`
- si falla cualquier validación/tests/build, el hub no publica SDD

Para sync selectivo manual (sin `build-hub` global), valida drift primero:

```bash
./scripts/check-selective-sync-drift.sh
```

Si este checker devuelve drift, aplica sync selectivo del/los curso(s) afectados y después ejecuta:

```bash
./scripts/smoke-hub-runtime.sh
```

Modo rápido solo para debug local (no recomendado para publicar):

```bash
./scripts/build-hub.sh --fast
```

También puedes usar:

```bash
./scripts/build-hub.sh --mode strict
./scripts/build-hub.sh --mode fast
```

Compatibilidad legacy:

```bash
SKIP_SDD_AUDIT=1 ./scripts/build-hub.sh
```

El script además deja traza en `.runtime/build-hub.log`, evita ejecuciones concurrentes con lock y recupera automáticamente locks obsoletos (stale) tras cierres inesperados.
Además ejecuta un smoke test final de publicación (`scripts/verify-hub-build.py`) para validar que rutas y assets críticos quedaron consistentes antes de marcar el build como correcto.
En modo `strict`, también ejecuta smoke runtime real (`scripts/smoke-hub-runtime.sh`) levantando un servidor temporal y verificando endpoints (`/health`, `/config`, `/ios`, `/android`, `/sdd`, `/governance`, `/pumuki`).
Al finalizar, genera `.runtime/build-manifest.json` con trazabilidad de publicación (commits, hashes y tamaños de artefactos copiados), y además guarda snapshots históricos en `.runtime/build-manifests/` con retención automática de los últimos 40.

Si necesitas saltar el smoke runtime puntualmente:

```bash
SKIP_RUNTIME_SMOKE=1 ./scripts/build-hub.sh --strict
```

Consulta:

```bash
PORT="$(cat .runtime/hub.port)"
curl -X POST "http://127.0.0.1:${PORT}/assistant/query" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "maxTokens": 600,
    "prompt": "Explícame este diagrama",
    "context": {
      "courseId": "stack-my-architecture-ios",
      "topicId": "tema-actual"
    },
    "images": []
  }'
```

Curso **Pumuki** (`/pumuki/`): usa `"courseId": "stack-my-architecture-pumuki"` en el mismo campo `context`.

```bash
curl -X POST "http://127.0.0.1:${PORT}/assistant/query" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "maxTokens": 600,
    "prompt": "Resume el módulo de instalación de Pumuki",
    "context": {
      "courseId": "stack-my-architecture-pumuki",
      "topicId": "02-modulos-02-instalacion-y-primer-verde"
    },
    "images": []
  }'
```

## Adjuntos de imágenes

- Máximo `3` imágenes por consulta.
- Tipos permitidos: `image/png` y `image/jpeg`.
- Tamaño máximo por imagen (tras compresión): `3MB`.
- Formato esperado por imagen:

```json
{
  "name": "captura.png",
  "type": "image/png",
  "data": "<base64-sin-prefijo>"
}
```

- Puedes adjuntar también con:
  - `⌘V` / `Ctrl+V` (pegar captura desde portapapeles)
  - drag & drop directamente sobre el panel del asistente.

## Modelos con visión y fallback

- El panel permite seleccionar modelo manualmente.
- Si la consulta incluye imágenes y el modelo no soporta visión:
  - el proxy aplica fallback automático a `gpt-4o-mini`
  - devuelve `warning` en la respuesta para que el panel lo muestre.

## Caché y limpieza de historial IA

- El panel incluye caché local por curso (`Usar caché`) para reutilizar respuestas de consultas idénticas.
- Puedes limpiar manualmente con `🧽 Limpiar caché`.
- `🧹 Limpiar contexto` reinicia contexto conversacional del hilo actual.
- `🗑 Borrar historial IA` borra historial/memoria del asistente del curso actual sin tocar progreso de estudio.
