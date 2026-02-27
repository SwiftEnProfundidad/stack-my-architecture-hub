# STACK ARCHITECTURE MASTER TRACKER

Fecha de actualización: 2026-02-27

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
21. Standby operativo del bloque BYOK cerrado administrativamente por instrucción explícita del usuario.
22. Pendientes de higiene SDD cerrados: upstream de `main` configurado y artefactos locales excluidos de tracking.
23. Auditoría profunda cross-course completada sobre iOS/Android/SDD (fuente + dist + runtime Hub) con evidencia técnica y visual.
24. Hallazgo crítico de enlaces en SDD (`/tmp/helpdesk-board-export.md`) corregido y revalidado en verde.
25. Índice raíz de `anexos/` y guía de leyenda Mermaid (4 flechas) estandarizados en los 3 cursos.
26. Calibración de `scripts/validate-pedagogy.py` en SDD cerrada con TDD (RED/GREEN/REFACTOR) y cobertura de tests para falsos positivos de listas/tablas.
27. Backlog iOS de Mermaid semántica cerrado (`P2: 5 -> 0`) y publicación selectiva cross-course en Hub revalidada (`no drift 6/6` + smoke OK).
28. Backlog iOS de trazabilidad scaffold cerrado (`P2: 4 -> 0`) y publicación selectiva de iOS en Hub validada (`no drift 6/6` + smoke OK).
29. Publicación productiva en Vercel revalidada tras build estricto del Hub, manteniendo BYOK multi-provider en paneles IA.
30. Leyenda Mermaid de flechas alineada visualmente en iOS/Android/SDD (puntas centradas con su línea) y publicada en Hub sin regresión runtime.
31. Lecciones núcleo de iOS ahora aplican y explican explícitamente las 4 flechas Mermaid sobre el diagrama real de módulos/features de la app ejemplo.
32. Refuerzo pedagógico de semántica de flechas Mermaid extendido a Android y SDD; los 3 cursos (iOS/Android/SDD) aplican explícitamente las 4 flechas en lecciones núcleo y están publicados en Hub.
33. Cobertura total del bloque de flechas Mermaid completada en orden iOS -> Android -> SDD:
    - iOS: `58/58` lecciones con Mermaid en 4 flechas.
    - Android: `10/10` lecciones con Mermaid en 4 flechas.
    - SDD: `157/157` lecciones con Mermaid (excluyendo `00-informe`) en 4 flechas.
34. Plan operativo versionado para este bloque en `docs/PLAN-COBERTURA-TOTAL-FLECHAS-20260227.md`.
35. Buscador lateral de lecciones integrado en iOS/Android/SDD y publicado en Hub con sync selectivo estable.
36. Ajuste UX del buscador lateral: bloque `INDICE + buscador` fijo al scroll y con separación superior corregida en iOS/Android/SDD.
37. Guardrail de publicación aplicado en Hub: `build-hub.sh` preserva `assets/assistant-panel.js` de `ios/android/sdd` durante sync para no romper BYOK multi-provider.
38. Bloque empleabilidad + rigor enterprise cerrado end-to-end en GitFlow:
    - iOS PR `#12` merge `2767696`.
    - Android PR `#9` merge `483744f`.
    - SDD PR `#10` merge `6c2fa09`.
    - Hub PR `#33` merge `079bfbb`.
    - Plan operativo activo: `docs/PLAN-MAESTRO-IMPLEMENTACION-CURSOS-20260227.md`.
39. Plan maestro reabierto por instrucción explícita del usuario para ejecución completa por fases:
    - Task `0.1` cerrada con inventario exacto cross-course en `docs/INVENTARIO-CROSS-COURSE-LECCIONES-ANEXOS-20260227.tsv`.
    - Task `0.2` abierta con baseline automático P0/P1/P2 en `docs/MATRIZ-BRECHAS-CROSS-COURSE-20260227.tsv`.
40. Ejecución automática del plan maestro completada en repos fuente:
    - iOS PR `#13` merge `1fbb0c8` (cierre de brechas accionables P0/P1 en lecciones).
    - Android PR `#10` merge `d183d1e` (cierre de brechas accionables P0/P1 en lecciones).
    - SDD PR `#11` merge `aa1e4cf` (auditoría de fase) y PR `#12` merge `7deaa30` (ajuste validador pedagógico).
41. Backlog de brechas accionables cerrado:
    - Matriz automática: `P0=3` solo en archivos administrativos (`CHANGELOG`, `ADR`) excluidos del alcance de lección.
    - Backlog de lecciones reales: `P0=0`, `P1=0`.
42. Corrección post-cierre por regresión visual Mermaid:
    - iOS PR `#14` merge `e2a2e91`.
    - Android PR `#11` merge `03db5b8`.
    - Scope: reemplazo de sintaxis problemática `-.o` por semántica robusta `-->`, `-.->`, `==>`, `--o`; ajuste de renderer + validador.

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
21. Higiene SDD (artefactos locales) mergeada en `develop` de monorepo SDD por PR `#2` (`7981f59`).
22. Auditoría profunda de cursos y lecciones cerrada con informe maestro:
    - `docs/AUDITORIA-CURSOS-PROFUNDA-20260226.md`
    - evidencias visuales en `output/playwright/`
23. Calibración del validador pedagógico SDD:
    - tests unitarios nuevos en `scripts/tests/test_validate_pedagogy.py`
    - `python3 -m unittest scripts/tests/test_validate_pedagogy.py` -> PASS
    - `python3 scripts/validate-pedagogy.py` -> PASS (148 files)
24. Cierre de backlog iOS Mermaid + publicación:
    - iOS PR `#5` (`chore/close-ios-mermaid-p2-20260226` -> `develop`) merge `4e41a5f`
    - Hub sync cross-course (`ios`, `android`, `sdd`) con `check-selective-sync-drift` en `no drift (6/6)` y smoke runtime OK
25. Cierre de backlog iOS trazabilidad scaffold + publicación selectiva:
    - iOS PR `#6` (`chore/close-ios-scaffold-p2-20260226` -> `develop`) merge `e07b197`
    - Hub sync selectivo `ios` con `check-selective-sync-drift` en `no drift (6/6)` y smoke runtime OK
26. Publicación productiva post-build estricto:
    - despliegue Vercel `production` aliasado en `https://architecture-stack.vercel.app`
    - verificación de rutas públicas `/, /ios/, /android/, /sdd/` en `200`
    - preservación de BYOK multi-provider en `assistant-panel.js` para `ios/android/sdd`
27. Cierre de bug visual de leyenda de flechas Mermaid:
    - iOS PR `#7` (`fix/legend-arrows-alignment-20260226` -> `develop`) merge `dcc51fe`
    - Android PR `#4` (`fix/legend-arrows-alignment-20260226` -> `develop`) merge `06da672`
    - SDD PR `#5` (`fix/legend-arrows-alignment-20260226` -> `develop`) merge `9d1620a`
    - Hub sync selectivo de `ios/android/sdd` revalidado (`no drift 6/6` + smoke OK)
28. Refuerzo pedagógico iOS de semántica de flechas Mermaid:
    - iOS PR `#8` (`feature/ios-arrow-semantics-in-lessons-20260226` -> `develop`) merge `1ea125e`
    - lecciones actualizadas: `02-integracion/09-app-final-etapa-2.md` y `04-arquitecto/05-guia-arquitectura.md`
    - Hub sync selectivo de `ios` revalidado (`no drift 6/6` + smoke OK)
29. Refuerzo pedagógico cross-course de semántica Mermaid (Android + SDD) + publicación Hub:
    - Android PR `#5` (`feature/android-arrow-semantics-lessons-20260227` -> `develop`) merge `3cbddcf`
    - SDD PR `#6` (`feature/sdd-arrow-semantics-lessons-20260227` -> `develop`) merge `fe8a8a6`
    - Hub sync selectivo cross-course (`ios`, `android`, `sdd`) merge `7f9520c`
30. Cobertura total de semántica Mermaid en repos fuente + publicación Hub:
    - iOS PR `#9` (`feature/ios-arrow-semantics-full-coverage-20260227` -> `develop`) merge `062ac6d`
    - Android PR `#6` (`feature/android-arrow-semantics-full-coverage-20260227` -> `develop`) merge `a83b6ba`
    - SDD PR `#7` (`feature/sdd-arrow-semantics-full-coverage-20260227` -> `develop`) merge `b5c23fa`
    - Hub sync selectivo full coverage (`ios`, `android`, `sdd`) merge `dae0e49` (PR `#28`).
31. Buscador lateral de lecciones cross-course + publicación Hub:
    - iOS PR `#10` (`feature/ios-sidebar-search-20260227` -> `develop`) merge `e5cbf6a`
    - Android PR `#7` (`feature/android-sidebar-search-20260227` -> `develop`) merge `269ed6f`
    - SDD PR `#8` (`feature/sdd-sidebar-search-20260227` -> `develop`) merge `76f70dc`
    - Hub sync selectivo (`ios`, `android`, `sdd`) commit `f057c62` en `chore/hub-sync-sidebar-search-20260227`
32. Ajuste UX de sidebar sticky + espaciado superior:
    - iOS PR `#11` (`fix/ios-sidebar-sticky-search-20260227` -> `develop`) merge `0427c63`
    - Android PR `#8` (`fix/android-sidebar-sticky-search-20260227` -> `develop`) merge `1cf8fa4`
    - SDD PR `#9` (`fix/sdd-sidebar-sticky-search-20260227` -> `develop`) merge `bd2b6a3`
    - Hub sync selectivo (`ios`, `android`, `sdd`) commit `ae04a43` en `fix/hub-sidebar-sticky-search-20260227`
33. Guardrail anti-sobrescritura de assistant panel + resync:
    - Hub fix guardrail: `fix/hub-preserve-assistant-panel-sync-20260227` commit `7178c28`
    - Hub resync post-guardrail (`ios`, `android`, `sdd`) commit `89a2e7f`
    - Smoke runtime reforzado con assert BYOK (`KEY_PROVIDER`) en `ios/android/sdd/assets/assistant-panel.js`
34. Cierre del bloque empleabilidad + rigor enterprise:
    - iOS PR `#12` (`feature/ios-learning-gates-foundation-20260227` -> `develop`) merge `2767696`
    - Android PR `#9` (`feature/android-learning-gates-foundation-20260227` -> `develop`) merge `483744f`
    - SDD PR `#10` (`feature/sdd-learning-gates-foundation-20260227` -> `develop`) merge `6c2fa09`
    - Hub PR `#33` (`chore/hub-diagram-styleguide-foundation-20260227` -> `develop`) merge `079bfbb`

## Tablero operativo (solo 1 en construcción)
1. ✅ Publicar sync selectivo cross-course iOS + Android + SDD en Hub (`c9cd8c3`).
2. ✅ Ciclos de espera activa consolidados (último: `2026-02-25 11:21 CET`) con `no drift (6/6)` y smoke OK.
3. ✅ Espera activa del próximo cierre en repos fuente cerrada por consolidación anti-bucle (2026-02-25), sin trigger técnico pendiente.
4. ✅ Standby operativo cerrado por trigger explícito del usuario para abrir bloque BYOK.
5. ✅ Cerrar bloque BYOK multi-provider en GitFlow (push, PR, merge y actualización final de tracking).
6. ✅ Standby operativo posterior al BYOK cerrado administrativamente por instrucción explícita del usuario.
7. ✅ Cerrar pendientes de higiene SDD (upstream de `main` + exclusión de artefactos locales no versionables).
8. ✅ Cerrar auditoría profunda de cursos (línea a línea + Mermaid/snippets + visual QA 3 temas + anexos).
9. ✅ Afinar `scripts/validate-pedagogy.py` de SDD para reducir falsos positivos de listas/tablas sin degradar calidad.
10. ✅ Cerrar backlog iOS Mermaid semántica (`P2 5->0`) y publicar resync cross-course en Hub.
11. ✅ Cerrar backlog iOS de trazabilidad scaffold (`P2 4->0`) y publicar sync selectivo de iOS en Hub.
12. ✅ Publicar en Vercel el estado actual validado del Hub sin regresión de BYOK multi-provider.
13. ✅ Corregir alineación visual de la leyenda de flechas Mermaid (puntas centradas y consistentes en iOS/Android/SDD).
14. ✅ Reforzar semántica de flechas Mermaid en lecciones iOS con aplicación explícita en arquitectura real de la app ejemplo.
15. ✅ Extender aplicación explícita de las 4 flechas Mermaid a Android + SDD y publicar sync selectivo cross-course en Hub.
16. ✅ Cerrar cobertura total de semántica Mermaid en iOS -> Android -> SDD y publicar sync Hub (plan versionado).
17. ✅ Incorporar buscador de lecciones en sidebar para iOS/Android/SDD y publicar sync selectivo en Hub.
18. ✅ Fijar bloque `INDICE + buscador` al scroll de sidebar y corregir separación superior para evitar clipping visual.
19. ✅ Blindar build/sync del Hub para preservar `assistant-panel.js` y evitar regresión BYOK multi-provider.
20. ✅ Trigger operativo aplicado para abrir bloque de empleabilidad + rigor enterprise.
21. ✅ Cerrar bloque empleabilidad + rigor enterprise en GitFlow (push, PR, merge y cierre de tracking/handoff).
22. ✅ Ejecutar plan maestro de implementación de cursos en iOS/Android/SDD con GitFlow completo.
23. ✅ Cerrar Fase 0 y fases de ejecución por curso (iOS -> Android -> SDD).
24. ✅ Integración Hub final con `build-hub --mode strict`, `no drift (6/6)` y smoke OK.
25. ⛔ Despliegue final Vercel bloqueado por cuota diaria (`api-deployments-free-per-day`).
26. ✅ Corrección visual Mermaid post-cierre integrada y validada en Hub (`build-hub strict`, `no drift`, `smoke`).

## Bloqueos actuales
1. Bloqueo externo de publicación: cuota diaria de deployments Vercel agotada.
2. Riesgo de seguimiento: confusión en `codex resume` por filtro de `cwd`.
3. Riesgo de referencia remota en `SDD`: `origin/main` mantiene una línea distinta al baseline operativo actual (`main` local); no integrar sin instrucción explícita.

## Próximos pasos recomendados
1. Mantener este tracker como fuente única de estado transversal.
2. Reintentar despliegue Vercel cuando se resetee la cuota diaria.
3. Mantener política anti-bucle y registrar nuevos ciclos solo con trigger real.
4. Aplicar sync selectivo por curso (iOS/Android/SDD) cuando se cierren nuevos bloques en repos fuente.
5. Actualizar `docs/SESSION-HANDOFF.md` al cerrar cada sesión de trabajo.
6. Consolidar próximas decisiones operativas en `docs/DECISIONS-ADR-LITE.md`.

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
6. Cierre de higiene SDD:
   - PR: `SwiftEnProfundidad/stack-my-architecture#2` (`chore/sdd-ignore-local-artifacts-20260226` -> `develop`)
   - Commit merge: `7981f59`
   - Ajuste local operativo: `main` en SDD con upstream `origin/main` y `.git/info/exclude` saneado (`.vercel/`, `dist/`, `project/`).
7. Validación técnica del bloque de auditoría profunda:
   - iOS: `./scripts/run-qa-audit-bundle.sh` -> PASS
   - Android: `python3 scripts/check-links.py && python3 scripts/build-html.py` -> PASS
   - SDD: `python3 scripts/check-links.py && python3 scripts/validate-markdown-snippets.py && python3 scripts/build-html.py` -> PASS
   - Visual QA Hub (Playwright CLI): `ios/android/sdd` en `enterprise|bold|paper` + `light|dark` -> contraste AA y leyenda 4 flechas OK (6/6 por curso)
8. Validación técnica del bloque de calibración de validador SDD:
   - `python3 -m unittest scripts/tests/test_validate_pedagogy.py` -> PASS (4/4)
   - `python3 scripts/validate-pedagogy.py` -> PASS (148 files)
   - `python3 scripts/check-links.py` -> PASS
   - `python3 scripts/validate-lesson-sequence.py` -> PASS
   - `python3 scripts/validate-markdown-snippets.py` -> PASS
   - `python3 scripts/build-html.py` -> PASS
9. Validación técnica del bloque de cierre backlog iOS Mermaid + publicación:
   - iOS: `python3 scripts/audit-mermaid-semantic.py` -> `OK=151, P1=0, P2=0`
   - iOS: `./scripts/run-qa-audit-bundle.sh` -> PASS
   - Hub: `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`
   - Hub: `./scripts/smoke-hub-runtime.sh` -> OK
10. Validación técnica del bloque de cierre backlog iOS trazabilidad scaffold + publicación:
   - iOS: `python3 scripts/audit-scaffold-traceability.py` -> `Hallazgos: total=0 (P1=0, P2=0)`
   - iOS: `./scripts/run-qa-audit-bundle.sh` -> PASS
   - Hub: `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`
   - Hub: `./scripts/smoke-hub-runtime.sh` -> OK
11. Validación técnica del bloque de publicación productiva en Vercel:
    - Hub: `./scripts/build-hub.sh --mode strict` -> PASS
    - Hub: `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`
    - Hub: `./scripts/smoke-hub-runtime.sh` -> OK
    - Vercel: `npx -y vercel deploy --prod --yes` -> alias `https://architecture-stack.vercel.app`
    - Runtime público: `/, /ios/, /android/, /sdd/` en `200`
12. Validación técnica del bloque de alineación visual de leyenda Mermaid:
    - RED: dist previo detectado con geometría desalineada (`height: 0`, `top: -5px`, `top: -4px`) en iOS/Android/SDD.
    - GREEN:
      - iOS: `python3 scripts/build-html.py` -> PASS (117 archivos).
      - Android: `python3 scripts/build-html.py` -> PASS (80 archivos).
      - SDD: `python3 scripts/build-html.py` -> PASS (262 archivos).
    - REFACTOR: CSS unificado en `scripts/build-html.py` de los 3 cursos con línea/punta centradas (`top: 50%` + `translateY(-50%)`).
    - Hub: `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
    - Hub: `./scripts/smoke-hub-runtime.sh` -> OK.
    - Visual QA (Playwright CLI) en `ios/android/sdd`: métricas de alineación consistentes (`lineTop=6px`, `headTop=6px`, `height=12px`).
13. Validación técnica del bloque pedagógico de flechas Mermaid en iOS:
    - iOS: `python3 scripts/build-html.py` -> PASS (117 archivos).
    - Cobertura lecciones (no anexos) con 4 flechas (`-->`, `-.->`, `-.o`, `--o`): 2/2
      - `02-integracion/09-app-final-etapa-2.md`
      - `04-arquitecto/05-guia-arquitectura.md`
    - Hub: `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
    - Hub: `./scripts/smoke-hub-runtime.sh` -> OK.
14. Validación técnica del bloque cross-course Android + SDD de flechas Mermaid:
    - Android: `python3 scripts/check-links.py && python3 scripts/build-html.py` -> PASS.
    - SDD: `python3 scripts/check-links.py && python3 scripts/validate-markdown-snippets.py && python3 scripts/build-html.py` -> PASS.
    - Cobertura lecciones (no anexos) con 4 flechas (`-->`, `-.->`, `-.o`, `--o`):
      - iOS: `2/2`
      - Android: `2/2`
      - SDD: `2/2`
    - Hub: `./scripts/build-hub.sh --mode strict` -> PASS.
    - Hub: `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
    - Hub: `./scripts/smoke-hub-runtime.sh` -> OK.
    - Merges de origen:
      - Android PR `#5` -> `3cbddcf`
      - SDD PR `#6` -> `fe8a8a6`
15. Validación técnica del bloque de cobertura total Mermaid (iOS -> Android -> SDD):
    - iOS:
      - `python3 scripts/build-html.py` -> PASS.
      - cobertura lecciones con Mermaid: `58/58` en 4 flechas.
      - PR `#9` -> merge `062ac6d`.
    - Android:
      - `python3 scripts/check-links.py && python3 scripts/build-html.py` -> PASS.
      - cobertura lecciones con Mermaid: `10/10` en 4 flechas.
      - PR `#6` -> merge `a83b6ba`.
    - SDD:
      - `python3 scripts/check-links.py && python3 scripts/validate-markdown-snippets.py && python3 scripts/build-html.py` -> PASS.
      - cobertura lecciones con Mermaid (excluyendo `00-informe`): `157/157` en 4 flechas.
      - PR `#7` -> merge `b5c23fa`.
    - Hub:
      - `./scripts/build-hub.sh --mode strict` -> PASS.
      - `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
      - `./scripts/smoke-hub-runtime.sh` -> OK.
      - plan de ejecucion: `docs/PLAN-COBERTURA-TOTAL-FLECHAS-20260227.md`.
16. Validación técnica del bloque de buscador lateral cross-course:
    - iOS:
      - `python3 scripts/build-html.py` -> PASS.
      - PR `#10` merge `e5cbf6a`.
    - Android:
      - `python3 scripts/check-links.py && python3 scripts/build-html.py` -> PASS.
      - PR `#7` merge `269ed6f`.
    - SDD:
      - `python3 scripts/validate-course-structure.py` -> PASS.
      - `python3 scripts/validate-openspec.py` -> PASS.
      - `python3 scripts/check-links.py` -> PASS.
      - `python3 scripts/validate-pedagogy.py` -> PASS.
      - `python3 scripts/validate-markdown-snippets.py` -> PASS.
      - `python3 scripts/build-html.py` -> PASS.
      - `swift test --package-path project/HelpdeskSDD` -> PASS.
      - PR `#8` merge `76f70dc`.
    - Hub:
      - `./scripts/build-hub.sh --mode strict` -> PASS.
      - `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
      - `./scripts/smoke-hub-runtime.sh` -> OK.
      - sync selectivo versionado: `f057c62` (`chore(hub): sync course bundles with sidebar search`).
17. Validación técnica del bloque de sticky/espaciado de sidebar:
    - iOS:
      - `python3 scripts/build-html.py` -> PASS.
      - PR `#11` merge `0427c63`.
    - Android:
      - `python3 scripts/check-links.py && python3 scripts/build-html.py` -> PASS.
      - PR `#8` merge `1cf8fa4`.
    - SDD:
      - `python3 scripts/validate-course-structure.py` -> PASS.
      - `python3 scripts/validate-openspec.py` -> PASS.
      - `python3 scripts/check-links.py` -> PASS.
      - `python3 scripts/validate-pedagogy.py` -> PASS.
      - `python3 scripts/validate-markdown-snippets.py` -> PASS.
      - `python3 scripts/build-html.py` -> PASS.
      - `swift test --package-path project/HelpdeskSDD` -> PASS.
      - PR `#9` merge `bd2b6a3`.
    - Hub:
      - `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
      - `./scripts/smoke-hub-runtime.sh` -> OK.
      - sync selectivo versionado: `ae04a43` (`fix(hub): sync sticky sidebar search layout across courses`).
18. Validación técnica del bloque guardrail anti-sobrescritura BYOK:
    - Hub:
      - `./scripts/build-hub.sh --mode strict` -> PASS.
      - `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
      - `./scripts/smoke-hub-runtime.sh` -> OK.
      - smoke reforzado con asserts de `KEY_PROVIDER` en:
        - `/ios/assets/assistant-panel.js`
        - `/android/assets/assistant-panel.js`
        - `/sdd/assets/assistant-panel.js`
    - Versionado:
      - `7178c28` (`fix(hub): preserve assistant panel during course sync`)
      - `89a2e7f` (`chore(hub): resync course bundles after guardrail update`)

## Referencias de estabilidad del Hub
1. Commit: `1940c7d`
2. Tag: `hub-stable-20260224`
3. Repo: `stack-my-architecture-hub`
