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

## Hitos cerrados
1. Reubicación de repos en carpeta contenedora única.
2. Regeneración de launchers/apps de escritorio del Hub.
3. Hardening del arranque/health-check del Hub.
4. Verificación de rutas publicadas de cursos (`/ios`, `/android`, `/sdd`).
5. Commit de estabilidad en Hub.
6. Tag de estabilidad en Hub.
7. Sync versionado de bundles de cursos en Hub (`b4399a7`).

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
2. Rutas activas verificadas en runtime local:
   - `/index.html` -> 200
   - `/ios/index.html` -> 200
   - `/android/index.html` -> 200
   - `/sdd/index.html` -> 200
3. Commit asociado del bloque operativo: `b4399a7`.

## Referencias de estabilidad del Hub
1. Commit: `1940c7d`
2. Tag: `hub-stable-20260224`
3. Repo: `stack-my-architecture-hub`
