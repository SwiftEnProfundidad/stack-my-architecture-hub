# STACK ARCHITECTURE MASTER TRACKER

Fecha de actualización: 2026-02-25

## Leyenda
- ✅ Hecho
- 🚧 En construccion (maximo 1)
- ⏳ Pendiente
- ⛔ Bloqueado

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
8. iOS Fase 6 cerrada: pipeline de enlaces/anchors + revisión visual trimestral Mermaid/assets completadas y versionadas.
9. Sync selectivo de iOS aplicado en Hub y validado por smoke runtime.
10. Sync selectivo de Android + SDD aplicado en Hub con validación de integridad y smoke runtime en verde.
11. Sync selectivo cross-course (iOS + Android + SDD) publicado en Hub con verificación `cmp` 6/6 y runtime smoke en verde.
12. Gate automático de deriva para sync selectivo disponible en `scripts/check-selective-sync-drift.sh` con test shell versionado.
13. Ciclo de espera activa ejecutado (2026-02-25) con gate automático: sin drift (`6/6`) y runtime smoke en verde.
14. Baseline operativo de control fijado en `develop` para `ios/android/SDD` en cumplimiento del contrato GitFlow hard de `AGENTS.md`.
15. Re-ejecución de ciclo de espera activa sobre baseline `develop` (2026-02-25 10:17 CET): sin drift (`6/6`) y smoke OK.
16. Ciclo de espera activa recurrente (2026-02-25 11:14 CET) con baseline operativo actual en `main` (`ios/android/SDD`): sin drift (`6/6`) y smoke OK.
17. Ciclo de espera activa recurrente (2026-02-25 11:21 CET) sobre baseline `main`: sin drift (`6/6`) y smoke OK.

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
10. Ajuste de tracking SDD a estado real en `main` (`34fb52a`) y resync final de Hub SDD (`d8d286e`).
11. Cierre operativo iOS Fase 6:
    - `0291000` (pipeline enlaces/anchors automatizado)
    - `c2f3e40` (revisión visual trimestral Mermaid/assets + evidencia)
12. Publicación selectiva iOS en Hub (`bcba91d`) con validación runtime en verde.
13. Publicación selectiva Android + SDD en Hub (`dac88cc`) con validación de integridad (`cmp`) y runtime smoke.
14. Publicación selectiva cross-course iOS + Android + SDD en Hub (`c9cd8c3`) con validación de integridad (`cmp` 6/6) y runtime smoke.
15. Checker automatizado de drift para sync selectivo (`2c01f15`) con cobertura de casos `match`, `drift` y `missing source`.
16. Ciclo de espera activa sin publicación (2026-02-25): `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)` y `./scripts/smoke-hub-runtime.sh` -> OK.
17. Ciclo de espera activa baseline `main` (2026-02-25 09:56 CET): `no drift (6/6)` + smoke OK, sin publicación requerida.
18. Transición de baseline a `develop` en repos fuente (2026-02-25 10:04 CET) + ciclo de espera activa en verde (`no drift 6/6` + smoke OK).
19. Ciclo de espera activa recurrente (2026-02-25 10:17 CET) sobre `develop`: `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)` y `./scripts/smoke-hub-runtime.sh` -> OK.
20. Ciclo de espera activa recurrente (2026-02-25 11:14 CET) sobre baseline `main`: `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)` y `./scripts/smoke-hub-runtime.sh` -> OK.
21. Ciclo de espera activa recurrente (2026-02-25 11:21 CET) sobre baseline `main`: `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)` y `./scripts/smoke-hub-runtime.sh` -> OK.

## Tablero operativo (solo 1 en construcción)
1. ✅ Publicar sync selectivo cross-course iOS + Android + SDD en Hub (`c9cd8c3`).
2. ✅ Ciclo de control de espera activa ejecutado el 2026-02-25: sin drift (`6/6`) y smoke OK.
3. ✅ Espera activa recurrente ejecutada (2026-02-25 11:14 CET): sin drift (`6/6`) y smoke OK sobre baseline operativo actual (`main`).
4. ✅ Espera activa recurrente ejecutada (2026-02-25 11:21 CET): sin drift (`6/6`) y smoke OK sobre baseline `main`.
5. 🚧 Espera activa del próximo cierre en repos fuente para ejecutar nuevo sync selectivo en Hub (gate: `./scripts/check-selective-sync-drift.sh` + smoke runtime).

## Bloqueos actuales
1. Ninguno operativo en la app/hub.
2. Riesgo de seguimiento: confusión en `codex resume` por filtro de `cwd`.
3. Riesgo de referencia remota en `SDD`: `origin/main` mantiene una línea distinta al baseline operativo actual (`main` local); no integrar sin instrucción explícita.

## Próximos pasos recomendados
1. Mantener este tracker como fuente única de estado transversal.
2. Aplicar sync selectivo por curso (iOS/Android/SDD) cuando se cierren nuevos bloques en repos fuente.
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
   - `34fb52a` (SDD tracking actualizado en main)
   - `017b3dc` (Hub sync SDD post-merge)
   - `d8d286e` (Hub resync SDD con tracking final)
   - `bcba91d` (Hub sync selectivo iOS post Fase 6)
   - `dac88cc` (Hub sync selectivo Android + SDD)
   - `c9cd8c3` (Hub sync selectivo cross-course iOS + Android + SDD)

## Referencias de estabilidad del Hub
1. Commit: `1940c7d`
2. Tag: `hub-stable-20260224`
3. Repo: `stack-my-architecture-hub`
