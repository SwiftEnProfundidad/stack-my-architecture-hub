# STACK ARCHITECTURE MASTER TRACKER

Fecha de actualización: 2026-02-24

## Objetivo global
Unificar operación y seguimiento de los 4 repos del ecosistema Stack My Architecture sin perder continuidad entre sesiones.

## Repos activos
1. `stack-my-architecture-hub`
2. `stack-my-architecture-SDD`
3. `stack-my-architecture-ios`
4. `stack-my-architecture-android`

## Estado actual
1. Workspace unificado en `.../Developer/Projects/stack-my-architecture`.
2. Hub estabilizado tras incidencia de `Cannot GET /index.html`.
3. Hito de estabilidad del Hub registrado en commit y tag.
4. Flujo de seguimiento cross-chat estandarizado con documentos `docs/`.
5. Hub sincronizado con bundles actualizados de iOS/Android/SDD.
6. Validación runtime del Hub en verde tras sincronización.
7. SDD week06 offline-cache integrado en `main` con ciclo RED-GREEN-REFACTOR completo.

## Hitos cerrados
1. Reubicación de repos en carpeta contenedora única.
2. Regeneración de launchers/apps de escritorio del Hub.
3. Hardening del arranque/health-check del Hub.
4. Verificación de rutas publicadas de cursos (`/ios`, `/android`, `/sdd`).
5. Commit de estabilidad en Hub.
6. Tag de estabilidad en Hub.
7. Sync versionado de bundles de cursos en Hub (`b4399a7`).
8. Merge en SDD de `week06-offline-cache-partial-sync` (`76d5764`).
9. Sync versionado en Hub solo del bundle SDD post-merge (`017b3dc`).

## Bloqueos actuales
1. Ninguno operativo en la app/hub.
2. Riesgo de seguimiento: confusión en `codex resume` por filtro de `cwd`.

## Próximos pasos recomendados
1. Mantener este tracker como fuente única de estado transversal.
2. Registrar cada cambio de Hub en `docs/HUB-STABILITY-LOG.md`.
3. Actualizar `docs/SESSION-HANDOFF.md` al cerrar cada sesión de trabajo.
4. Consolidar decisiones de operación en `docs/DECISIONS-ADR-LITE.md`.

## Última validación operativa
1. Runtime smoke: `./scripts/smoke-hub-runtime.sh` -> OK.
2. Runtime smoke verifica rutas del Hub en servidor temporal:
   - `/index.html` -> OK
   - `/ios/index.html` -> OK
   - `/android/index.html` -> OK
   - `/sdd/index.html` -> OK
3. Commits asociados del bloque operativo:
   - `76d5764` (SDD main merge)
   - `017b3dc` (Hub sync SDD)

## Referencias de estabilidad del Hub
1. Commit: `1940c7d`
2. Tag: `hub-stable-20260224`
3. Repo: `stack-my-architecture-hub`
