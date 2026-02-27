# HUB STABILITY LOG

Fecha base: 2026-02-24

## Incidencia
### Síntoma
La app abría en `127.0.0.1:46100/index.html` y devolvía `Cannot GET /index.html`.

### Diagnóstico
1. Había instancia stale respondiendo `/health` pero no sirviendo el frontend publicado.
2. El check de salud era demasiado permisivo y aceptaba proceso no válido para serving real.

## Corrección aplicada
Archivo principal:
- `stack-my-architecture-hub/scripts/launch-hub.sh`

Mejoras clave:
1. `health_ok()` valida payload de `/health`:
   - `"ok":true`
   - `"service":"assistant-bridge"`
2. `health_ok()` valida también `GET /index.html`.
3. Resolución robusta de `node`/`npm` para entornos Desktop App sin PATH completo.
4. Fallback robusto para apertura de navegador (Chrome, Safari, Comet, default, osascript).
5. Arranque tolerante sin `OPENAI_API_KEY` (hub operativo sin chat IA).

## Verificación funcional realizada
1. `GET /index.html` -> OK
2. `GET /ios/index.html` -> OK
3. `GET /android/index.html` -> OK
4. `GET /sdd/index.html` -> OK

## Evidencia de cierre
1. Commit: `1940c7d`
2. Tag: `hub-stable-20260224`
3. Estado: Estable

## Regresión post-sync de cursos
### Fecha
2026-02-24

### Contexto
Se sincronizaron los bundles publicados de `ios`, `android` y `sdd` en el Hub para reflejar el estado actual de los repos fuente.

### Evidencia versionada
1. Commit: `b4399a7`
2. Scope: `ios/*.html`, `android/*.html`, `sdd/*.html`

### Verificación funcional
1. `./scripts/smoke-hub-runtime.sh` -> OK (runtime smoke en puerto temporal).
2. Validación manual de rutas en runtime local activo:
   - `GET /index.html` -> 200
   - `GET /ios/index.html` -> 200
   - `GET /android/index.html` -> 200
   - `GET /sdd/index.html` -> 200

### Resultado
Hub mantiene estabilidad operativa y apertura de cursos tras el sync.

## Regresión post-merge SDD week06
### Fecha
2026-02-24

### Contexto
Se integró en `stack-my-architecture-SDD/main` el bloque week06 de sincronización parcial offline (`76d5764`) y se sincronizó solo el bundle publicado de SDD en Hub para evitar arrastre de WIP en iOS/Android.

### Evidencia versionada
1. SDD merge: `76d5764` (`merge(week06): integrate offline partial sync tdd cycle`)
2. Hub sync SDD: `017b3dc` (`chore(hub): sync sdd bundle after week06 tdd cycle`)
3. Scope Hub: `sdd/*.html`

### Verificación funcional
1. `./scripts/smoke-hub-runtime.sh` -> OK (runtime smoke en puerto temporal).
2. Validación de rutas de cursos dentro de smoke:
   - `/index.html` -> OK
   - `/ios/index.html` -> OK
   - `/android/index.html` -> OK
   - `/sdd/index.html` -> OK

### Resultado
El Hub conserva estabilidad y apertura de cursos tras integrar el cambio de SDD.

## Resync final por normalización de tracking SDD
### Fecha
2026-02-24

### Contexto
Tras cerrar el ticket en `main` de SDD, se normalizó el estado de tracking (`branch: main`) para reflejar estado real (`34fb52a`). Se aplicó un resync final del bundle SDD en Hub.

### Evidencia versionada
1. SDD tracking real en main: `34fb52a`
2. Hub resync SDD: `d8d286e`

### Verificación funcional
1. `./scripts/smoke-hub-runtime.sh` -> OK.
2. Rutas de cursos verificadas dentro de smoke -> OK.

### Resultado
Hub permanece estable tras la normalización final de tracking y publicación SDD.

## Regresión post-sync selectivo iOS Fase 6
### Fecha
2026-02-24

### Contexto
Tras cerrar en iOS la Fase 6 de QA (pipeline de enlaces/anchors + revisión visual trimestral), se sincronizó únicamente el bundle publicado de iOS en Hub para evitar arrastre de WIP en Android/SDD.

### Evidencia versionada
1. iOS cierre Fase 6:
   - `0291000` (`chore(qa): automate links-anchor validation in dist pipeline`)
   - `c2f3e40` (`chore(qa): close quarterly visual mermaid-assets review`)
2. Hub sync selectivo iOS: `bcba91d` (`chore(hub): sync ios bundle after phase6 qa closure`)
3. Scope Hub: `ios/*.html`

### Verificación funcional
1. `./scripts/smoke-hub-runtime.sh` -> OK (puerto temporal `46210`).
2. Rutas verificadas dentro del smoke:
   - `/index.html` -> OK
   - `/ios/index.html` -> OK
   - `/android/index.html` -> OK
   - `/sdd/index.html` -> OK

### Resultado
Hub mantiene estabilidad operativa tras publicar selectivamente iOS.

## Regresión post-sync selectivo Android + SDD
### Fecha
2026-02-24

### Contexto
Se validaron los cambios pendientes de `android/*.html` y `sdd/*.html` en Hub contra sus repos fuente y se publicaron de forma selectiva.

### Evidencia versionada
1. Hub sync selectivo Android + SDD: `dac88cc` (`chore(hub): sync android and sdd bundles`)
2. Scope Hub:
   - `android/curso-stack-my-architecture-android.html`
   - `android/index.html`
   - `sdd/curso-stack-my-architecture-sdd.html`
   - `sdd/index.html`

### Verificación funcional
1. Comparación binaria con fuentes `dist` -> OK (`cmp` en 4/4 archivos).
2. `./scripts/smoke-hub-runtime.sh` -> OK (puerto temporal `46210`).
3. Rutas verificadas dentro del smoke:
   - `/index.html` -> OK
   - `/ios/index.html` -> OK
   - `/android/index.html` -> OK
   - `/sdd/index.html` -> OK

### Resultado
Hub se mantiene estable tras sincronizar Android + SDD.

## Regresión post-sync selectivo cross-course iOS + Android + SDD
### Fecha
2026-02-25

### Contexto
Se detectaron cambios versionables en bundles publicados de `ios`, `android` y `sdd` en Hub y se aplicó sync selectivo cross-course manteniendo política de no publicar WIP fuera de alcance.

### Evidencia versionada
1. Hub sync cross-course: `c9cd8c3` (`chore(hub): sync ios android sdd bundles from source dist`)
2. Scope Hub:
   - `ios/curso-stack-my-architecture.html`
   - `ios/index.html`
   - `android/curso-stack-my-architecture-android.html`
   - `android/index.html`
   - `sdd/curso-stack-my-architecture-sdd.html`
   - `sdd/index.html`

### Verificación funcional
1. Comparación binaria con repos fuente -> OK (`cmp` 6/6):
   - `ios/index.html` se valida contra `stack-my-architecture-ios/dist/curso-stack-my-architecture.html` (mirror operativo del curso en iOS).
2. `./scripts/smoke-hub-runtime.sh` -> OK (puerto temporal `46210`).
3. Rutas verificadas dentro de smoke:
   - `/index.html` -> OK
   - `/ios/index.html` -> OK
   - `/android/index.html` -> OK
   - `/sdd/index.html` -> OK

### Resultado
Hub mantiene estabilidad operativa tras el sync selectivo cross-course.

## Ciclo de espera activa sin publicación
### Fecha
2026-02-25

### Contexto
Se ejecutó ciclo de control para detectar deriva entre bundles publicados del Hub y `dist` de repos fuente, sin cambios de publicación pendientes.

### Verificación funcional
1. `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
2. `./scripts/smoke-hub-runtime.sh` -> OK (puerto temporal `46210`).
3. Rutas verificadas dentro de smoke:
   - `/index.html` -> OK
   - `/ios/index.html` -> OK
   - `/android/index.html` -> OK
   - `/sdd/index.html` -> OK

### Resultado
No se requiere sync selectivo en este ciclo; Hub permanece estable.

## Ciclos de espera activa consolidados (sin publicación)
### Fecha
2026-02-25

### Contexto
Se registraron varios ciclos de espera activa durante ajuste de baseline operativo (`main`/`develop`) sin cambios de publicación selectiva.

### Ejecuciones registradas
1. `09:56 CET` baseline `main` (`ios`, `android`, `SDD` local) -> `no drift (6/6)` + smoke OK.
2. `10:04 CET` y `10:17 CET` baseline `develop` -> `no drift (6/6)` + smoke OK.
3. `11:14 CET` y `11:21 CET` baseline `main` -> `no drift (6/6)` + smoke OK.

### Evidencia técnica común
1. `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
2. `./scripts/smoke-hub-runtime.sh` -> OK (puerto temporal `46210`).
3. Rutas verificadas dentro de smoke:
   - `/index.html` -> OK
   - `/ios/index.html` -> OK
   - `/android/index.html` -> OK
   - `/sdd/index.html` -> OK

## Regresión post-cierre backlog iOS Mermaid + resync cross-course
### Fecha
2026-02-26

### Contexto
Se cerró en iOS el backlog de coherencia semántica Mermaid (hallazgos `P2` de `5 -> 0`) y se aplicó resync selectivo cross-course de bundles publicados (`ios`, `android`, `sdd`) en Hub para alinear runtime con estado fuente actual.

### Evidencia versionada
1. iOS cierre backlog Mermaid:
   - PR: `SwiftEnProfundidad/stack-my-architecture-ios#5`
   - Merge commit: `4e41a5f`
2. Hub resync cross-course post-backlog:
   - branch de publicación: `chore/sync-bundles-after-backlog-phase-20260226`
   - validación de deriva: `no drift (6/6)` tras copia selectiva

### Verificación funcional
1. `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
2. `./scripts/smoke-hub-runtime.sh` -> OK (puerto temporal `46210`).
3. Rutas verificadas dentro de smoke:
   - `/index.html` -> OK
   - `/ios/index.html` -> OK
   - `/android/index.html` -> OK
   - `/sdd/index.html` -> OK

### Resultado
Hub mantiene estabilidad operativa tras publicar el cierre de backlog iOS y sincronizar bundles cross-course.

### Resultado
No se requiere sync selectivo en estos ciclos; Hub permanece estable.

### Política anti-bucle
Registrar un nuevo ciclo en este log solo cuando exista trigger real:
1. merge/cierre versionado en repo fuente,
2. deriva detectada por `check-selective-sync-drift.sh`, o
3. instrucción explícita del usuario.

## Regresión post-bloque BYOK multi-provider (merge en develop)
### Fecha
2026-02-26

### Contexto
Trigger explícito para abandonar standby e iniciar refuerzo económico del asistente IA:
1. BYOK obligatorio por request para evitar consumo de key de plataforma.
2. Soporte multi-provider en bridge serverless (`openai`, `anthropic`, `gemini`).
3. Paneles de cursos alineados con selector de proveedor + API key por sesión.

### Evidencia versionada
1. `04e087a` (`test(hub): define byok multi-provider assistant contract (red)`)
2. `7eb89d4` (`feat(hub): enforce byok with openai claude gemini providers (green)`)
3. `32d3e6f` (`docs(tracking): log byok block and keep single in-progress task (refactor)`)
4. Merge PR `#16` en `develop`: `6aeb7e0`

### Verificación funcional
1. `node --test scripts/tests/test-assistant-bridge-byok.js` -> PASS (5/5).
2. `./scripts/tests/test-check-selective-sync-drift.sh` -> PASS.
3. `./scripts/smoke-hub-runtime.sh` -> OK (rutas base en verde).

### Resultado
Hub sigue estable y el asistente queda desacoplado de una key de servidor obligatoria.

## Cierre administrativo de standby operativo
### Fecha
2026-02-26

### Contexto
Tras completar el bloque BYOK multi-provider y su merge en `develop`, se solicitó cierre explícito de la task de standby operativo.

### Acción aplicada
1. Standby marcado como `✅` en `MASTER-TRACKER` y `SESSION-HANDOFF`.
2. Estado operativo regresado a espera pasiva sin task en construcción.

### Resultado
Continuidad estable sin trabajo activo pendiente; próximo bloque se abrirá solo con trigger real.

## Cierre de pendientes de higiene SDD
### Fecha
2026-02-26

### Contexto
Quedaban dos pendientes operativos detectados en `stack-my-architecture-SDD`:
1. `main` sin upstream configurado.
2. Artefactos locales no versionables (`.vercel/`, `dist/`, `project/`) apareciendo como `untracked`.

### Acción aplicada
1. Upstream de `main` configurado a `origin/main` en el entorno local operativo.
2. Exclusión de artefactos de ruido cerrada por dos capas:
   - versionada en `develop` del monorepo SDD vía PR `#2` (`7981f59`),
   - local inmediata en `.git/info/exclude` para mantener `main` limpio.

### Resultado
Repositorio SDD en estado limpio para operación diaria sin ruido en `git status`.

## Regresión post-cierre backlog iOS trazabilidad scaffold + sync selectivo iOS
### Fecha
2026-02-26

### Contexto
Se cerró en iOS el backlog de trazabilidad contra scaffold (hallazgos `P2` de `4 -> 0`) y se publicó únicamente el bundle de `ios` en Hub para mantener alineado el runtime sin arrastrar cambios no relacionados de otros cursos.

### Evidencia versionada
1. iOS cierre backlog trazabilidad scaffold:
   - PR: `SwiftEnProfundidad/stack-my-architecture-ios#6`
   - Merge commit: `e07b197`
2. Hub sync selectivo post-cierre:
   - branch de publicación: `docs/tracking-close-ios-scaffold-p2-20260226`
   - validación de deriva: `no drift (6/6)` tras copia selectiva de `ios`

### Verificación funcional
1. `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
2. `./scripts/smoke-hub-runtime.sh` -> OK (puerto temporal `46210`).
3. Rutas verificadas dentro de smoke:
   - `/index.html` -> OK
   - `/ios/index.html` -> OK
   - `/android/index.html` -> OK
   - `/sdd/index.html` -> OK

### Resultado
Hub mantiene estabilidad operativa tras publicar el cierre de trazabilidad scaffold en iOS.

## Publicación productiva post-build estricto sin regresión BYOK
### Fecha
2026-02-26

### Contexto
Tras validar build estricto del Hub se detectó que la copia AS-IS desde cursos fuente reemplazaba `assistant-panel.js` por una variante sin selector de proveedor/BYOK. Se preservó la variante BYOK multi-provider en Hub y se publicó a producción.

### Acción aplicada
1. Build estricto en verde: `./scripts/build-hub.sh --mode strict`.
2. Revalidación local de integridad runtime:
   - `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`
   - `./scripts/smoke-hub-runtime.sh` -> OK.
3. Restauración explícita de `assistant-panel.js` BYOK multi-provider en:
   - `ios/assets/assistant-panel.js`
   - `android/assets/assistant-panel.js`
   - `sdd/assets/assistant-panel.js`
4. Publicación productiva:
   - `npx -y vercel deploy --prod --yes`
   - alias final `https://architecture-stack.vercel.app`.

### Verificación funcional
1. Rutas públicas:
   - `https://architecture-stack.vercel.app/` -> `200`
   - `https://architecture-stack.vercel.app/ios/` -> `200`
   - `https://architecture-stack.vercel.app/android/` -> `200`
   - `https://architecture-stack.vercel.app/sdd/` -> `200`
2. Verificación de BYOK en runtime público:
   - `ios/assets/assistant-panel.js` contiene `KEY_PROVIDER`, opciones `anthropic/gemini` y campo `API key (BYOK)`.

### Resultado
Producción publicada y estable con contenido actualizado, rutas en verde y panel IA manteniendo BYOK multi-provider.

## Regresión post-fix visual de leyenda Mermaid (flechas) + sync selectivo
### Fecha
2026-02-26

### Contexto
Se detectó regresión visual en la leyenda de flechas Mermaid: puntas desplazadas respecto a su línea en runtime. Se aplicó corrección en los tres generadores de curso y se republicaron bundles selectivamente en Hub.

### Evidencia versionada
1. iOS:
   - PR: `SwiftEnProfundidad/stack-my-architecture-ios#7`
   - Merge commit: `dcc51fe`
2. Android:
   - PR: `SwiftEnProfundidad/stack-my-architecture-android#4`
   - Merge commit: `06da672`
3. SDD:
   - PR: `SwiftEnProfundidad/stack-my-architecture#5`
   - Merge commit: `9d1620a`

### Verificación funcional
1. RED: dist previo mostraba geometría desalineada (`height: 0`, `top: -5px`, `top: -4px`).
2. GREEN:
   - `python3 scripts/build-html.py` en iOS/Android/SDD -> PASS.
3. REFACTOR:
   - CSS unificado en los 3 builders con línea y punta centradas (`top: 50%` + `translateY(-50%)`).
4. Hub:
   - `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
   - `./scripts/smoke-hub-runtime.sh` -> OK.
5. Validación visual Playwright CLI:
   - métricas homogéneas en `ios/android/sdd`: `lineTop=6px`, `headTop=6px`, `height=12px`.

### Resultado
Hub mantiene estabilidad operativa y la leyenda de flechas queda visualmente alineada en los tres cursos.

## Regresión post-refuerzo pedagógico iOS de semántica Mermaid + sync selectivo
### Fecha
2026-02-26

### Contexto
Se detectó brecha didáctica: las lecciones de arquitectura iOS no aplicaban de forma explícita las 4 flechas Mermaid (`-->`, `-.->`, `-.o`, `--o`) sobre el diagrama real de módulos/features de la app ejemplo.

### Evidencia versionada
1. iOS:
   - PR: `SwiftEnProfundidad/stack-my-architecture-ios#8`
   - Merge commit: `1ea125e`
   - Lecciones actualizadas:
     - `02-integracion/09-app-final-etapa-2.md`
     - `04-arquitecto/05-guia-arquitectura.md`

### Verificación funcional
1. iOS:
   - `python3 scripts/build-html.py` -> PASS.
   - cobertura en lecciones (sin anexos) con las 4 flechas en Mermaid: `2/2`.
2. Hub:
   - `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
   - `./scripts/smoke-hub-runtime.sh` -> OK.
   - rutas verificadas: `/index.html`, `/ios/index.html`, `/android/index.html`, `/sdd/index.html` -> OK.

### Resultado
Hub mantiene estabilidad operativa tras publicar el refuerzo pedagógico de flechas en iOS.

## Regresión post-refuerzo pedagógico cross-course (Android + SDD) + sync selectivo
### Fecha
2026-02-27

### Contexto
Tras cerrar el refuerzo iOS, se detectó brecha equivalente en Android y SDD: faltaba aplicar y explicar explícitamente las 4 flechas Mermaid (`-->`, `-.->`, `-.o`, `--o`) en lecciones núcleo de arquitectura/wiring de la app ejemplo.

### Evidencia versionada
1. Android:
   - PR: `SwiftEnProfundidad/stack-my-architecture-android#5`
   - Merge commit: `3cbddcf`
2. SDD:
   - PR: `SwiftEnProfundidad/stack-my-architecture#6`
   - Merge commit: `fe8a8a6`
3. Hub:
   - Sync selectivo cross-course (`ios`, `android`, `sdd`) merge `7f9520c`

### Verificación funcional
1. Android:
   - `python3 scripts/check-links.py && python3 scripts/build-html.py` -> PASS.
2. SDD:
   - `python3 scripts/check-links.py && python3 scripts/validate-markdown-snippets.py && python3 scripts/build-html.py` -> PASS.
3. Cobertura lecciones (sin anexos) con las 4 flechas Mermaid:
   - iOS: `2/2`
   - Android: `2/2`
   - SDD: `2/2`
4. Hub:
   - `./scripts/build-hub.sh --mode strict` -> PASS.
   - `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
   - `./scripts/smoke-hub-runtime.sh` -> OK.
5. Rutas verificadas dentro de smoke:
   - `/index.html` -> OK
   - `/ios/index.html` -> OK
   - `/android/index.html` -> OK
   - `/sdd/index.html` -> OK

### Resultado
Hub mantiene estabilidad operativa tras extender el refuerzo semántico de flechas a los tres cursos.

## Regresión post-cobertura total Mermaid (iOS -> Android -> SDD) + sync full coverage
### Fecha
2026-02-27

### Contexto
Se ejecutó un bloque completo para pasar de cobertura puntual a cobertura total de semántica Mermaid en lecciones con diagrama:
1. iOS primero, luego Android, y finalmente SDD.
2. Inclusión explícita de `-->`, `-.->`, `-.o`, `--o` en las lecciones pendientes.
3. Publicación de bundles actualizados en Hub sin alterar BYOK multi-provider.

### Evidencia versionada
1. iOS:
   - PR: `SwiftEnProfundidad/stack-my-architecture-ios#9`
   - Merge commit: `062ac6d`
2. Android:
   - PR: `SwiftEnProfundidad/stack-my-architecture-android#6`
   - Merge commit: `a83b6ba`
3. SDD:
   - PR: `SwiftEnProfundidad/stack-my-architecture#7`
   - Merge commit: `b5c23fa`
4. Hub:
   - Sync full coverage merge `dae0e49` (PR `#28`)

### Verificación funcional
1. Cobertura lecciones con Mermaid:
   - iOS: `58/58` con 4 flechas.
   - Android: `10/10` con 4 flechas.
   - SDD: `157/157` con 4 flechas (excluyendo `00-informe`).
2. Validaciones de repos fuente:
   - iOS: `python3 scripts/build-html.py` -> PASS.
   - Android: `python3 scripts/check-links.py && python3 scripts/build-html.py` -> PASS.
   - SDD: `python3 scripts/check-links.py && python3 scripts/validate-markdown-snippets.py && python3 scripts/build-html.py` -> PASS.
3. Hub:
   - `./scripts/build-hub.sh --mode strict` -> PASS.
   - `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
   - `./scripts/smoke-hub-runtime.sh` -> OK.
4. Rutas verificadas dentro de smoke:
   - `/index.html` -> OK
   - `/ios/index.html` -> OK
   - `/android/index.html` -> OK
   - `/sdd/index.html` -> OK

### Resultado
Hub mantiene estabilidad operativa tras publicar la cobertura total Mermaid en los 3 cursos.

## Nota operativa
Si reaparece síntoma similar:
1. Revisar `.runtime/hub.port` y `.runtime/hub.pid` del hub.
2. Validar `/health` + `/index.html` en el puerto activo.
3. Reiniciar Hub con launcher actual.
