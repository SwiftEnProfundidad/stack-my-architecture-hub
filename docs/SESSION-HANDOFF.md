# SEGUIMIENTO ÚNICO DE BLOQUE

Ruta de contexto: `/Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture`

## Leyenda
- ✅ Hecho
- 🚧 En construccion (máximo 1)
- ⏳ Pendiente
- ⛔ Bloqueado

## Estado operativo actual
- ✅ Bloque operativo anterior cerrado: `Hardening de release (pipeline de publicación de guardas anti-regresión)`.
- ✅ Bloque activo anterior cerrado: `Release gate enterprise de producción + runbook de operación`.
- ✅ Bloque actual finalizado: `Limpieza enterprise + seguimiento único con evidencia actualizada`.
- ✅ Último cierre confirmado: `notes + bookmarks` en Hub con acceso autenticado (SUPABASE_ANON_KEY + RLS).
- ✅ Limpieza enterprise ejecutada: tracking unificado, basura de workspace eliminada y `.gitignore` endurecido.
- ✅ Evidencia de smoke/cross-repo:
  - `npm run quality-gates` ✅ en `stack-my-architecture-SDD/stack-my-architecture-SDD` (json `passed: true`).
  - `npm run hardening:check` ✅ en `stack-my-architecture-SDD/stack-my-architecture-SDD`.
  - `scripts/smoke-hub-runtime.sh` ✅ en `stack-my-architecture-hub` (port 46801).
  - `./gradlew --version` ✅ en `stack-my-architecture-android/proyecto-android` y `stack-my-architecture-SDD/stack-my-architecture-android/proyecto-android`.

## Tareas del bloque
1. ✅ Ejecutar higiene de repositorio:
   - Mantener un único md de seguimiento (`SESSION-HANDOFF.md`) en `stack-my-architecture-hub/docs`.
   - Eliminar mds cerrados repetidos y rutas basura (`.playwright-cli`, `output`, `.DS_Store`).
2. ✅ Ejecutar smoke pre-publicación cross-repo (build + closeout) en rutas críticas.
3. ✅ Añadir guardas anti-regresión: Mermaid, navegación entre cursos, routes/locales y assets versionados.
4. ✅ Cerrar bloque con evidencia (estado green) y preparar retorno a estado limpio.
5. ✅ Abrir siguiente bloque y definir su alcance con mismo formato de seguimiento.
6. ✅ Ejecutar estabilización de pipeline de release: integrar guardas anti-regresión en build publish.
   - Ejecutada en esta iteración: guardas integradas al flujo de build y a gate CI de publicación sin dependencia externa.
7. ✅ Preparar release gate enterprise de producción: definir workflow de publicación manual con aprobación y checklist de evidencia.
   - Ejecutada en esta iteración: workflow `.github/workflows/hub-production-release-gate.yml` creado con prechecks y evidencia.
8. ✅ Abrir runbook de operación release: documentar uso, aprobadores y criterios de rollback.
9. ✅ Fortalecer release gate con postchecks de producción y evidencia explícita.
   - Ejecutadas: postcheck configurable en `hub-production-release-gate.yml`, evidencia en checklist/logs.
10. ✅ Dejar único md de seguimiento (con leyenda) y eliminar mds de seguimiento cerrados + residuos identificados.
11. ✅ Verificación de limpieza enterprise post-bloque:
   - Confirmado que no existen basura de salida `.playwright-cli`, `output` ni `.DS_Store` en `stack-my-architecture`.
   - Confirmado que se mantiene un único md de seguimiento dentro del ámbito operativo actual (`docs/SESSION-HANDOFF.md`).
   - Se deja constancia de `stack-my-architecture-SDD/go-to-market/PHASE_TRACKER.md` como tracker funcional externo (no cerrado).

## Evidencia reciente
- ✅ `scripts/validate-course-surface-guard.sh` + `scripts/tests/test-course-surface-guard-suite.sh` añadidos y conectados a `scripts/run-closeout-qa-suite.sh`.
- ✅ Nueva guardia valida:
  - locales y metadatos base (`lang=\"es\"`, `course-id`) en páginas raíz y de cursos.
  - navegación de switcher y estructura de enlaces de lección.
  - coherencia de `?v=` unificada en assets críticos entre iOS / Android / SDD.
- ✅ Limpieza de contexto confirmada: no quedan directorios basura relevantes (`.playwright-cli`, `output`, `.DS_Store`) en `stack-my-architecture/`.
- ✅ Build hardening aplicado: `scripts/build-hub.sh` ahora ejecuta `scripts/validate-course-surface-guard.sh` como parte de la verificación de publicación.
- ✅ Workflow `Hub Production Release Gate` creado con publicación manual + prechecks y evidencia (`.github/workflows/hub-production-release-gate.yml`).
- ✅ Release gate reforzado con postchecks reales en producción (`run_postchecks`) e integración al checklist de evidencia.

## Alcance propuesto del bloque 7 (release gate enterprise)
- ✅ `hub-surface-guard-qa.yml` añadido: CI de PR/push aislada para cursos iOS/Android/SDD (smoke + guardas anti-regresión + versión de assets).
- ✅ `build-hub.sh` ejecuta `validate-course-surface-guard.sh` antes de smoke/runtime y queda atado al path de publish.
- ✅ `publish-architecture-stack.sh` queda acoplado a build publish hardened, porque `build-hub.sh` valida `course-surface-guard` en el pre-deploy.
- ✅ `Hub Production Release Gate` añade:
  - workflow_dispatch manual para publicar a producción.
  - precheck de evidencia pre-publicación (`test-public-smoke-suite`, `test-course-surface-guard-suite`, `test-stamp-asset-version`).
  - ejecución de `publish-architecture-stack.sh`.
  - generación de evidencia en artefacto (`release-checklist.md`, logs y build manifest).

## Contrato operativo post-deploy (bloque 8)
- ✅ Definido y operativo:
  - Check canario obligatorio tras despliegue con `scripts/post-deploy-checks.sh`:
    - rutas públicas (`smoke-public-routes.sh`).
    - smoke funcional (`smoke-public-functional.sh`).
    - evidencia por ejecución: timestamp UTC, logs de cada check, estado de continuidad y estado de congelación (freeze).
  - Evidencia persistente:
    - `checklist.md` en artefacto de GitHub Actions.
    - `post-deploy-canary-<ts>.md`, `post-deploy-state.env` y `post-deploy-history.jsonl` en runtime de ejecución.
    - estado actualizado de `post-deploy-freeze.flag` cuando aplica.
  - Política de rollback/freno automático:
    - Si hay 2 fallos post-deploy consecutivos, la corrida se marca con `freeze_state=active`, se escribe `post-deploy-freeze.flag` y se bloquea el siguiente intento de publicación (`publish-architecture-stack.sh`).
    - El bloque puede despejarse manualmente con `SMA_CLEAR_POST_DEPLOY_FREEZE=1` en una corrida de recuperación controlada.
    - Tras 2 despliegues verdes consecutivos, se limpia el freeze y el contrato continúa en verde.
  - Revisión semanal:
    - Se añadirá revisión del estado `post-deploy-state.env` y del histórico (`post-deploy-history.jsonl`) en cada runbook de release semanal.
    - Si aparece freeze activo, revisar causa + evidencia del último canary y bloquear promoción hasta cierre operativo.

## Bloque en curso
1. ✅ Definido y desplegado contrato operativo de post-deploy para evitar regresiones de producción.
  - Entregado en workflow `hub-production-release-gate.yml`.
  - Entregado en `scripts/post-deploy-checks.sh` con evidencia persistente y estado de freeze.
  - Entregado en `scripts/publish-architecture-stack.sh` con bloqueo automático cuando hay freeze activo.
  - Enlace de evidencia de referencia: `hub-release-evidence/checklist.md` (artefacto de GH Actions).
2. ✅ Cerrar ciclo de ingeniería del bloque:
  - ✅ PR abierto y mergeado: [#173](https://github.com/SwiftEnProfundidad/stack-my-architecture-hub/pull/173).
  - ✅ `git push`/`git merge` completados contra `main`.
  - ✅ `origin/main` actualizado.
  - ✅ Estado limpio de workspace confirmado en la última pasada.
3. ✅ Cerrar regresión de autenticación entre hubs y cursos.
  - Se eliminó el redirect global `/(.*) -> https://architecture-stack.vercel.app/$1`.
  - Se dejó `vercel.json` con `rewrites` de `/api/:path*` hacia `https://architecture-stack.vercel.app/api/:path*` para conservar headers (Authorization) al consumir backend remoto estable.
  - Se conservaron redirecciones de funciones auxiliares hacia `assistant-bridge` del dominio funcional.
  - Objetivo de esta tarea: login + token no deben perderse al entrar por `stack-my-architecture-hub.vercel.app`.
4. ✅ Cerrar regresión de sesiones inválidas para cursos protegidos y flujo de login.
   - `study-ux` limpia sesión inválida y redirige al `auth/login.html` cuando no hay acceso activo, evitando "modo teaser" forzado con token corrupto.
   - Verificado con deploy en producción (`architecture-stack.vercel.app`/`stack-my-architecture-hub.vercel.app`) y smoke de rutas/runtime.
5. ✅ Corregir regresión de acceso local bloqueado tras hardening de guardias.
  - En `ios/assets/study-ux.js`, `android/assets/study-ux.js` y `sdd/assets/study-ux.js`, `isLocalContext()` quedó alineado con el guard de pagina para cubrir LAN locales (`localhost`, `127.0.0.1`, `10.x`, `192.168.x`, `172.16-31.x`, `*.local`) y forzar `fullAccess`.
  - La validación remota y limpieza de token inválido se mantiene para entornos con sesión real (`/api/entitlements`).
  - Estado operativo: accesos local y de navegación no quedan en candado por defecto.
6. ✅ Corregir pérdida de `Authorization` al usar API remota en Vercel.
  - Confirmado por `curl -v`: `/api/*` devolvía `307` y no reenviaba `Authorization` al dominio destino.
  - Actualizado `stack-my-architecture-hub/vercel.json` para `rewrites` en `/api/*`, `/progress/*` y endpoints de `assistant-bridge`.
  - Pendiente de validación: probar flujo completo con cuenta activa en `stack-my-architecture-hub.vercel.app` tras despliegue.
7. 🚧 Verificación manual de extremo a extremo con sesión real (log-in real + expiración/renovación de token).
  - Pendiente: validar en navegador con cuenta activa y registrar evidencia de token válido/no válido en producción y local.
8. Criterio de cierre:
  - 100% de postchecks verdes en al menos 2 deployments consecutivos.
  - Rollback automático documentado y probado con un escenario de fallo simulado sin impacto de datos.
