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

## Bloque en curso
1. 🚧 Definir contrato operativo de post-deploy para evitar regresiones de producción.
   - Alcance mínimo:
     - Ejecutar postchecks canary tras cada deployment (rutas críticas, smoke, versiones de assets y APIs clave).
     - Estandarizar evidencia por ejecución (`checklist` + logs + timestamp) y enlazarla desde este archivo.
     - Documentar política de rollback y criterio de freno automático cuando falle postcheck.
     - Añadir tarea de revisión semanal al runbook de release.
2. Criterio de cierre:
   - 100% de postchecks verdes en al menos 2 deployments consecutivos.
   - Rollback automático documentado y probado con un escenario de fallo simulado sin impacto de datos.
