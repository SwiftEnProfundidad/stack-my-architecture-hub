# STACK ARCHITECTURE MASTER TRACKER

Fecha de actualización: 2026-02-26

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
13. Gate automático de espera activa consolidado: última ejecución `2026-02-25 11:21 CET` sobre baseline `main` -> `no drift (6/6)` + smoke OK.
14. Histórico de baseline de control registrado: transición `develop -> main` documentada sin regresiones.
15. Política anti-bucle aplicada: no registrar ciclos repetidos sin trigger real (merge fuente, drift detectado o instrucción explícita).
16. Trigger explícito aplicado para abandonar standby e iniciar bloque BYOK multi-provider.
17. Fase RED del bloque BYOK cerrada con test de contrato serverless en `scripts/tests/test-assistant-bridge-byok.js`.
18. Fase GREEN del bloque BYOK cerrada: `api/assistant-bridge.js` ya exige BYOK y enruta `openai`, `anthropic` y `gemini`.
19. Paneles IA de `ios`, `android` y `sdd` alineados para selector de proveedor + API key por sesión.
20. Bloque BYOK multi-provider integrado en `develop` vía PR `#16` (merge `6aeb7e0`).

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
16. Ciclos de espera activa consolidados (2026-02-25):
    - baseline `main` (`09:56 CET`) -> `no drift (6/6)` + smoke OK
    - baseline `develop` (`10:04 CET` y `10:17 CET`) -> `no drift (6/6)` + smoke OK
    - baseline `main` recurrente (`11:14 CET` y `11:21 CET`) -> `no drift (6/6)` + smoke OK
17. Fase RED BYOK multi-provider (`04e087a`).
18. Fase GREEN BYOK multi-provider (`7eb89d4`).
19. Fase REFACTOR BYOK tracking/docs (`32d3e6f`).
20. Merge PR BYOK a `develop` (`6aeb7e0`).

## Tablero operativo (solo 1 en construcción)
1. ✅ Publicar sync selectivo cross-course iOS + Android + SDD en Hub (`c9cd8c3`).
2. ✅ Ciclos de espera activa consolidados (último: `2026-02-25 11:21 CET`) con `no drift (6/6)` y smoke OK.
3. ✅ Espera activa del próximo cierre en repos fuente cerrada por consolidación anti-bucle (2026-02-25), sin trigger técnico pendiente.
4. ✅ Standby operativo cerrado por trigger explícito del usuario para abrir bloque BYOK.
5. ✅ Cerrar bloque BYOK multi-provider en GitFlow (push, PR, merge y actualización final de tracking).
6. 🚧 Standby operativo: abrir próximo bloque solo con trigger real (merge fuente, drift detectado o instrucción explícita).

## Bloqueos actuales
1. Ninguno operativo en la app/hub.
2. Riesgo de seguimiento: confusión en `codex resume` por filtro de `cwd`.
3. Riesgo de referencia remota en `SDD`: `origin/main` mantiene una línea distinta al baseline operativo actual (`main` local); no integrar sin instrucción explícita.

## Próximos pasos recomendados
1. Mantener este tracker como fuente única de estado transversal.
2. Mantener política anti-bucle y registrar nuevos ciclos solo con trigger real.
3. Aplicar sync selectivo por curso (iOS/Android/SDD) cuando se cierren nuevos bloques en repos fuente.
4. Actualizar `docs/SESSION-HANDOFF.md` al cerrar cada sesión de trabajo.
5. Consolidar próximas decisiones operativas en `docs/DECISIONS-ADR-LITE.md`.

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
4. Validación técnica del bloque BYOK en feature branch:
   - `node --test scripts/tests/test-assistant-bridge-byok.js` -> PASS (5/5)
   - `./scripts/tests/test-check-selective-sync-drift.sh` -> PASS
   - `./scripts/smoke-hub-runtime.sh` -> OK
5. Merge de integración:
   - PR: `#16` (`feature/byok-multi-provider-assistant` -> `develop`)
   - Commit merge: `6aeb7e0`

## Referencias de estabilidad del Hub
1. Commit: `1940c7d`
2. Tag: `hub-stable-20260224`
3. Repo: `stack-my-architecture-hub`
