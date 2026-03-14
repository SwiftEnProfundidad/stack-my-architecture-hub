# HUB STABILITY LOG

Fecha base: 2026-02-24

## Hardening de versionado determinista de assets
### Fecha
2026-03-08

### Contexto
Tras cada publicación seguía apareciendo suciedad artificial en el worktree del Hub porque los `?v=` de los assets se recalculaban con marcas temporales. Eso forzaba resyncs innecesarios de artefactos aunque el contenido real no hubiera cambiado.

### Cambios aplicados
1. `iOS`, `Android` y `SDD` calculan `asset_version` a partir de hash de contenido de los assets realmente publicados.
2. `scripts/stamp-asset-version.py` del Hub deja de usar epoch time y pasa a calcular un hash determinista compartido sobre `ios/assets`, `android/assets` y `sdd/assets`.
3. Nueva regresión automática:
   - `scripts/tests/test-stamp-asset-version.sh`
   - integrada en `./scripts/run-closeout-qa-suite.sh`
4. Rebuild del Hub sincronizado con hashes estables en:
   - `ios/*.html`
   - `android/*.html`
   - `sdd/*.html`

### Evidencia técnica
1. `python3 scripts/build-html.py` ejecutado dos veces seguidas en `stack-my-architecture-ios` -> sin diffs adicionales.
2. `python3 scripts/build-html.py` ejecutado dos veces seguidas en `stack-my-architecture-android` -> sin diffs adicionales.
3. `python3 stack-my-architecture-SDD/scripts/build-html.py` ejecutado dos veces seguidas en `stack-my-architecture-SDD` -> sin diffs adicionales.
4. `./scripts/tests/test-stamp-asset-version.sh` -> PASS.
5. `./scripts/run-closeout-qa-suite.sh tests` -> PASS.
6. `./scripts/build-hub.sh --fast` ejecutado dos veces -> mismo resultado estable.

### Resultado
El versionado de assets queda ligado al contenido real y ya no a la hora del build. El Hub reduce suciedad post-deploy y evita resyncs espurios de artefactos publicados.

## Hardening anti-cache + acceso local sin login (hotfix)
### Fecha
2026-03-03

### Contexto
Se detectaron regresiones intermitentes de cliente asociadas a caché agresiva del navegador y a redirecciones no deseadas de login en entorno local.

### Cambios aplicados
1. Servidor local del Hub con cabeceras anti-cache estrictas (`no-store`, `no-cache`, `must-revalidate`) en todas las respuestas.
2. `build-hub` añade stamping automático de versión en assets `css/js` (`?v=<build>`), para invalidar caché por build.
3. Verificación de build normalizada para aceptar cambios de `?v=` sin falsos positivos.
4. `vercel.json` publica cabeceras anti-cache globales para rutas estáticas.
5. `course-switcher.js` en iOS/Android/SDD y Hub reconoce contexto local (localhost + LAN privada) y evita bloqueo de cursos por login cloud.

### Evidencia técnica
1. `SKIP_RUNTIME_SMOKE=1 ./scripts/build-hub.sh --mode fast` -> PASS.
2. `python3 scripts/verify-hub-build.py` -> PASS.
3. Smoke local Playwright:
   - `index.html` -> `Abrir curso iOS` navega a `/ios/index.html` sin redirección a login en local.
4. Validación de cabeceras:
   - `curl -I /index.html` y `curl -I /ios/index.html` incluyen `Cache-Control: no-store`.

### Resultado
Hotfix de continuidad aplicado: menor riesgo de servir versiones antiguas y acceso local estable para iteración sin backend cloud.

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

## Regresión post-optimización de carga móvil (Fase 1)
### Fecha
2026-03-01

### Contexto
Se aplicó optimización runtime en generadores de cursos (`iOS`, `Android`, `SDD`) para reducir carga inicial en móvil sin tocar contenido:
1. Mermaid diferido por viewport.
2. Highlight de snippets diferido por viewport.
3. Imágenes Markdown con `loading="lazy"` y `decoding="async"`.
4. `content-visibility` por sección de lección.

### Evidencia versionada
1. Rebuild fuente:
   - `python3 scripts/build-html.py` en `stack-my-architecture-ios` -> OK
   - `python3 scripts/build-html.py` en `stack-my-architecture-android` -> OK
   - `python3 scripts/build-html.py` en `stack-my-architecture-SDD` -> OK
2. Hub strict:
   - `./scripts/build-hub.sh --mode strict` -> OK
3. Smoke runtime:
   - check de `assistant-panel.js` ahora acepta marcador BYOK (`KEY_PROVIDER`) o marcador legacy (`KEY_DAILY_BUDGET`) para evitar falso negativo de smoke en variantes de panel.

### Verificación funcional
1. Rutas runtime en smoke:
   - `/index.html` -> OK
   - `/ios/index.html` -> OK
   - `/android/index.html` -> OK
   - `/sdd/index.html` -> OK
2. Validación visual Playwright local:
   - render inicial diferido confirmado (solo subset inicial de Mermaid/snippets en primer paint).
   - incremento progresivo de render al navegar/scroll.

### Resultado
Sin regresión de apertura de cursos y con carga inicial más liviana en cliente móvil.

## Regresión post-hardening del asistente IA en runtime móvil (Fase 4)
### Fecha
2026-03-01

### Contexto
Se detectó que los cursos publicados en Hub seguían haciendo comprobaciones `/health` del asistente IA en arranque en frío. Se aplicó hardening para diferir la carga de `assistant-panel.js` hasta interacción del usuario.

### Cambios aplicados
1. `assistant-bridge.js` en iOS/Android/SDD:
   - carga dinámica de `assistant-panel.js` solo al abrir asistente o consultar selección.
2. `scripts/build-html.py` en iOS/Android/SDD:
   - publicación de `window.__SMA_ASSISTANT_PANEL_SRC`.
   - eliminación de carga eager de `assistant-panel.js` en `<head>`.
3. `scripts/build-hub.sh`:
   - preservación de `assistant-panel.js` pasa a modo explícito (`PRESERVE_ASSISTANT_PANEL=1`) para permitir sync real desde repos fuente.

### Evidencia técnica
1. `python3 scripts/build-html.py` en iOS/Android/SDD -> OK.
2. `./scripts/build-hub.sh --mode strict` -> OK.
3. Playwright local (`ios/android/sdd`):
   - en carga inicial: sin requests `/health`.
   - al abrir asistente: carga `assistant-panel.js` on-demand, sin ping `/health` automático.

### Resultado
Carga inicial más ligera y eliminación de ruido de red del asistente IA al arranque, sin regresión en apertura de cursos ni en runtime del Hub.

## Regresión post-desacople CDN de renderizadores (Mermaid/Highlight)
### Fecha
2026-03-01

### Contexto
Se detectó lentitud perceptible en móvil cuando la red tardaba en resolver CDNs externos. Se movió la carga de renderizadores de diagramas/snippets desde `<head>` a runtime loader no bloqueante en los 3 cursos fuente.

### Cambios aplicados
1. `scripts/build-html.py` en iOS/Android/SDD:
   - se eliminan `<script defer ...>` de Mermaid/Highlight en `<head>`.
   - se publican `window.__SMA_MERMAID_SRC` y `window.__SMA_HLJS_*` para carga dinámica.
   - `renderMermaid()` e `initCodeHighlighting()` pasan a `async` con `ensure*Loaded()` y fallback seguro sin romper UX.
2. Hub:
   - sync actualizado de bundles `ios/android/sdd`.

### Evidencia técnica
1. Repos fuente:
   - `python3 -m py_compile scripts/build-html.py` (iOS/Android/SDD) -> PASS.
   - `python3 scripts/build-html.py` (iOS/Android/SDD) -> PASS.
2. Hub:
   - `./scripts/build-hub.sh --mode strict` -> PASS.
   - `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
   - `./scripts/smoke-hub-runtime.sh` -> OK.

### Resultado
Se reduce el bloqueo del arranque por dependencias CDN lentas, manteniendo render progresivo de Mermaid/snippets y estabilidad total de rutas/publicación.

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

## Regresión post-buscador lateral cross-course (iOS -> Android -> SDD) + sync selectivo
### Fecha
2026-02-27

### Contexto
Se identificó brecha de navegación en cursos largos: la sidebar no permitía búsqueda rápida por lección.
Se ejecutó cierre completo en repos fuente para agregar buscador live en navegación lateral y publicar los bundles resultantes en Hub.

### Evidencia versionada
1. iOS:
   - PR: `SwiftEnProfundidad/stack-my-architecture-ios#10`
   - Merge commit: `e5cbf6a`
2. Android:
   - PR: `SwiftEnProfundidad/stack-my-architecture-android#7`
   - Merge commit: `269ed6f`
3. SDD:
   - PR: `SwiftEnProfundidad/stack-my-architecture#8`
   - Merge commit: `76f70dc`
4. Hub:
   - Sync selectivo cross-course (`ios`, `android`, `sdd`) commit `f057c62`
   - branch: `chore/hub-sync-sidebar-search-20260227`

### Verificación funcional
1. Validación de repos fuente:
   - iOS: `python3 scripts/build-html.py` -> PASS.
   - Android: `python3 scripts/check-links.py && python3 scripts/build-html.py` -> PASS.
   - SDD:
     - `python3 scripts/validate-course-structure.py` -> PASS.
     - `python3 scripts/validate-openspec.py` -> PASS.
     - `python3 scripts/check-links.py` -> PASS.
     - `python3 scripts/validate-pedagogy.py` -> PASS.
     - `python3 scripts/validate-markdown-snippets.py` -> PASS.
     - `python3 scripts/build-html.py` -> PASS.
     - `swift test --package-path project/HelpdeskSDD` -> PASS.
2. Hub:
   - `./scripts/build-hub.sh --mode strict` -> PASS.
   - `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
   - `./scripts/smoke-hub-runtime.sh` -> OK.
3. Rutas verificadas dentro de smoke:
   - `/index.html` -> OK
   - `/ios/index.html` -> OK
   - `/android/index.html` -> OK
   - `/sdd/index.html` -> OK

### Resultado
Hub mantiene estabilidad operativa tras incorporar el buscador lateral en los 3 cursos y sincronizar publicación selectiva.

## Regresión post-fix visual de sidebar sticky (indice + buscador) + sync selectivo
### Fecha
2026-02-27

### Contexto
Se reportó degradación visual en sidebar de cursos:
1. el bloque de búsqueda se ocultaba al hacer scroll del menú,
2. el título `INDICE` quedaba demasiado pegado arriba con clipping parcial.
Se aplicó ajuste UX en repos fuente para fijar el bloque superior y aumentar separación vertical.

### Evidencia versionada
1. iOS:
   - PR: `SwiftEnProfundidad/stack-my-architecture-ios#11`
   - Merge commit: `0427c63`
2. Android:
   - PR: `SwiftEnProfundidad/stack-my-architecture-android#8`
   - Merge commit: `1cf8fa4`
3. SDD:
   - PR: `SwiftEnProfundidad/stack-my-architecture#9`
   - Merge commit: `bd2b6a3`
4. Hub:
   - Sync selectivo cross-course (`ios`, `android`, `sdd`) commit `ae04a43`
   - branch: `fix/hub-sidebar-sticky-search-20260227`

### Verificación funcional
1. Repos fuente:
   - iOS: `python3 scripts/build-html.py` -> PASS.
   - Android: `python3 scripts/check-links.py && python3 scripts/build-html.py` -> PASS.
   - SDD:
     - `python3 scripts/validate-course-structure.py` -> PASS.
     - `python3 scripts/validate-openspec.py` -> PASS.
     - `python3 scripts/check-links.py` -> PASS.
     - `python3 scripts/validate-pedagogy.py` -> PASS.
     - `python3 scripts/validate-markdown-snippets.py` -> PASS.
     - `python3 scripts/build-html.py` -> PASS.
     - `swift test --package-path project/HelpdeskSDD` -> PASS.
2. Hub:
   - `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
   - `./scripts/smoke-hub-runtime.sh` -> OK.
3. Rutas verificadas dentro de smoke:
   - `/index.html` -> OK
   - `/ios/index.html` -> OK
   - `/android/index.html` -> OK
   - `/sdd/index.html` -> OK

### Resultado
Hub mantiene estabilidad operativa tras el fix visual del bloque sticky de navegación en los tres cursos.

## Regresión post-guardrail de assistant panel + resync selectivo
### Fecha
2026-02-27

### Contexto
Se detectó una regresión operativa recurrente: `build-hub.sh` copiaba `dist` de cursos en modo AS-IS y sobrescribía `assets/assistant-panel.js` en Hub, degradando BYOK multi-provider.

### Evidencia versionada
1. Hub guardrail:
   - branch: `fix/hub-preserve-assistant-panel-sync-20260227`
   - commit: `7178c28` (`fix(hub): preserve assistant panel during course sync`)
2. Hub resync post-guardrail:
   - commit: `89a2e7f` (`chore(hub): resync course bundles after guardrail update`)

### Verificación funcional
1. `./scripts/build-hub.sh --mode strict` -> PASS.
2. `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
3. `./scripts/smoke-hub-runtime.sh` -> OK.
4. Asserts BYOK añadidos y verificados en smoke:
   - `/ios/assets/assistant-panel.js` contiene `KEY_PROVIDER`.
   - `/android/assets/assistant-panel.js` contiene `KEY_PROVIDER`.
   - `/sdd/assets/assistant-panel.js` contiene `KEY_PROVIDER`.
5. Rutas verificadas dentro de smoke:
   - `/index.html` -> OK
   - `/ios/index.html` -> OK
   - `/android/index.html` -> OK
   - `/sdd/index.html` -> OK

### Resultado
Hub mantiene estabilidad operativa y queda blindado frente a sobrescritura accidental de `assistant-panel.js` en próximos build/sync.

## Nota operativa
Si reaparece síntoma similar:
1. Revisar `.runtime/hub.port` y `.runtime/hub.pid` del hub.
2. Validar `/health` + `/index.html` en el puerto activo.
3. Reiniciar Hub con launcher actual.

## Regresión post-baseline empleabilidad + rigor enterprise
### Fecha
2026-02-27

### Contexto
Se activo un bloque cross-course para elevar empleabilidad y rigor enterprise con artefactos nuevos en iOS, Android y SDD, mas validadores automaticos y guia de diagramas en Hub.

### Evidencia versionada
1. iOS PR `#12` -> merge `2767696`.
2. Android PR `#9` -> merge `483744f`.
3. SDD PR `#10` -> merge `6c2fa09`.
4. Hub PR `#33` -> merge `079bfbb`.

### Incidencia detectada en RED
1. `./scripts/build-hub.sh --mode strict` fallo inicialmente por gate pedagogico en SDD.
2. Causa: los nuevos documentos en `00-informe/` no incluian bloque Mermaid ni artefacto no-Mermaid, requeridos por `scripts/validate-pedagogy.py`.
3. Correccion aplicada: se anadieron diagrama Mermaid y snippet versionable en los 3 archivos de `00-informe/` del bloque.

### Verificación funcional final
1. iOS:
   - `python3 scripts/validate-learning-gates.py` -> PASS.
   - `python3 scripts/validate-diagram-semantics.py` -> PASS.
   - `python3 scripts/build-html.py` -> PASS.
2. Android:
   - `python3 scripts/validate-learning-gates.py` -> PASS.
   - `python3 scripts/validate-diagram-semantics.py` -> PASS.
   - `python3 scripts/check-links.py` -> PASS.
   - `python3 scripts/build-html.py` -> PASS.
3. SDD:
   - `python3 scripts/validate-learning-gates.py` -> PASS.
   - `python3 scripts/validate-diagram-semantics.py` -> PASS.
   - `python3 scripts/validate-course-structure.py` -> PASS.
   - `python3 scripts/validate-openspec.py` -> PASS.
   - `python3 scripts/check-links.py` -> PASS.
   - `python3 scripts/validate-pedagogy.py` -> PASS.
   - `python3 scripts/validate-markdown-snippets.py` -> PASS.
   - `python3 scripts/build-html.py` -> PASS.
   - `swift test --package-path project/HelpdeskSDD` -> PASS.
4. Hub:
   - `./scripts/build-hub.sh --mode strict` -> PASS.
   - `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
   - `./scripts/smoke-hub-runtime.sh` -> OK.

### Resultado
Hub permanece estable tras el bloque de empleabilidad + rigor enterprise y mantiene rutas de cursos operativas sin regresion runtime.

## Regresión post-ejecución completa del plan maestro (iOS -> Android -> SDD)
### Fecha
2026-02-27

### Contexto
Se ejecutó el plan maestro completo de corrección de brechas en lecciones con alcance sobre iOS, Android y SDD, seguido de integración final en Hub.

### Evidencia versionada
1. iOS PR `#13` -> merge `1fbb0c8`.
2. Android PR `#10` -> merge `d183d1e`.
3. SDD PR `#11` -> merge `aa1e4cf`.
4. SDD PR `#12` -> merge `7deaa30`.
5. Hub PR `#36` -> merge `c0b65a5` (fase 0 baseline inventario+matriz).

### Verificación funcional
1. `./scripts/build-hub.sh --mode strict` -> PASS.
2. `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
3. `./scripts/smoke-hub-runtime.sh` -> OK.
4. Rutas runtime en verde:
   - `/index.html`
   - `/ios/index.html`
   - `/android/index.html`
   - `/sdd/index.html`

### Incidencia externa
Intento de despliegue final en Vercel bloqueado por cuota diaria:
- `api-deployments-free-per-day` (retry sugerido al reset de cuota).

### Resultado
Hub queda estable y listo para publicación; único bloqueo activo es externo (cuota Vercel), sin regresión técnica en runtime local.

## Regresión visual Mermaid post-cierre del plan maestro
### Fecha
2026-02-27

### Contexto
Se detectó degradación visual y de parseo en algunos diagramas Mermaid auto-insertados (`Syntax error in text`) por uso de sintaxis `-.o`.

### Evidencia versionada
1. iOS PR `#14` -> merge `e2a2e91`.
2. Android PR `#11` -> merge `03db5b8`.

### Corrección aplicada
1. Bloques Mermaid auto-gapfix actualizados con semántica válida y estable:
   - `-->` dependencia directa
   - `-.->` wiring/configuración
   - `==>` contrato/abstracción
   - `--o` salida/propagación
2. Ajuste de tooling:
   - `scripts/build-html.py` (leyenda y normalización Mermaid)
   - `scripts/validate-diagram-semantics.py` (cobertura de flechas alineada al estándar)

### Verificación funcional
1. Hub: `./scripts/build-hub.sh --mode strict` -> PASS.
2. Hub: `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
3. Hub: `./scripts/smoke-hub-runtime.sh` -> OK.
4. Visual: captura Playwright en iOS con diagrama renderizado sin error de sintaxis.

### Resultado
Se elimina la regresión visual/parse Mermaid y el Hub mantiene estabilidad operativa.

## Regresión post-upgrade SVG de arquitectura por capas (estilo mock)
### Fecha
2026-02-27

### Contexto
Se migró el render del diagrama de arquitectura por capas a SVG inline en repos fuente para alinear visualmente con el mock (módulos, flechas y leyenda consistente), y se publicó sync selectivo cross-course en Hub.

### Evidencia versionada
1. iOS PR `#15` -> merge `2208297`.
2. Android PR `#12` -> merge `3896bad`.
3. SDD PR `#13` -> merge `0338ba9`.
4. Hub sync bundles -> commit `06ab4cc`.

### Verificación funcional
1. Hub: `./scripts/build-hub.sh --mode strict` -> PASS.
2. Hub: `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
3. Hub: `./scripts/smoke-hub-runtime.sh` -> OK.
4. Rutas runtime en verde:
   - `/index.html`
   - `/ios/index.html`
   - `/android/index.html`
   - `/sdd/index.html`

### Resultado
Hub mantiene estabilidad operativa tras el upgrade SVG de arquitectura y conserva apertura correcta de cursos.

## Cierre Fase 2 mobile-first UX (cursos) + sync estable Hub
### Fecha
2026-03-01

### Contexto
Se cerró el bloque mobile-first en iOS/Android/SDD para iPhone pequeño:
1. Sidebar móvil off-canvas real con backdrop y cierre por `Esc`/tap.
2. Topbar global compacta en móvil (controles en scroll horizontal, sin solape).
3. Limpieza de líneas legacy `Siguiente: ...` para evitar duplicidad con botones de navegación UX.

### Verificación funcional
1. Hub: `./scripts/build-hub.sh --mode strict` -> PASS.
2. Hub: `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
3. Validación Playwright (`390x844`) en iOS/Android/SDD:
   - sidebar abre/cierra (`transform -> 0` al abrir),
   - topbar estable (`height=78px`, `padding-top=74px`),
   - sin líneas legacy `Siguiente:` en párrafos renderizados.

### Resultado
Hub mantiene estabilidad operativa tras cerrar Fase 2 y conserva apertura correcta de cursos en móvil.

## Cierre Fase 3 (validación final + deploy Vercel)
### Fecha
2026-03-01

### Contexto
Se cerró el bloque final del plan mobile/performance con deploy único a Vercel tras validar smoke local y métricas de carga percibida.

### Evidencia de validación
1. Smoke final local: `./scripts/build-hub.sh --mode strict` -> PASS.
2. Drift final: `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
3. Métrica móvil Playwright (`390x844`):
   - iOS: `domReadyMs=576`, `mermaid 3/228`, `hljs 16/659`.
   - Android: `domReadyMs=399`, `mermaid 3/26`, `hljs 16/222`.
   - SDD: `domReadyMs=434`, `mermaid 3/357`, `hljs 16/743`.
   - Topbar estable en los 3 cursos: `height=78px`, `padding-top=74px`.

### Evidencia de publicación
1. Deploy producción: `https://architecture-stack-7vplljuwi-merlosalbarracins-projects.vercel.app`
2. Alias activo: `https://architecture-stack.vercel.app`
3. Verificación HTTP de rutas públicas en producción:
   - `/` -> `200`
   - `/ios/index.html` -> `200`
   - `/android/index.html` -> `200`
   - `/sdd/index.html` -> `200`

### Resultado
Plan de fases mobile-first/performance cerrado end-to-end sin regresión de apertura de cursos.

## Cierre Fase 4.5 (responsive iPhone compacto)
### Fecha
2026-03-01

### Contexto
Se aplicó el pase final de compactación visual para iPhone estrecho (`<=480px`) en iOS/Android/SDD:
1. Etiquetas cortas en topbar de estudio (`✅ Hecho`, `🔁 Repaso`, `🧘 Zen`).
2. Conservación de accesibilidad con `aria-label`/`title` completos.
3. Ajuste de spacing/padding en topbar para reducir ruido visual sin pérdida funcional.

### Evidencia versionada
1. iOS PR `#21` -> merge `2a5766f`.
2. Android PR `#18` -> merge `5adb228`.
3. SDD PR `#19` -> merge `1c7bff3`.

### Verificación funcional
1. Hub: `./scripts/build-hub.sh --mode strict` -> PASS.
2. Hub: `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
3. Hub: `./scripts/smoke-hub-runtime.sh` -> OK.
4. Playwright local (`390x844`) en `ios/android/sdd`:
   - topbar compacta estable,
   - labels cortos visibles,
   - navegación y controles operativos.

### Resultado
Fase 4.5 cerrada sin regresión de apertura de cursos ni degradación de accesibilidad en móvil.

## Cierre Fase 5 (micro-optimización render navegación de lección)
### Fecha
2026-03-01

### Contexto
Se redujo coste de render en cambio de tema en iOS/Android/SDD:
1. Antes: `study-ux.js` reconstruía los controles de navegación para todas las lecciones en cada `renderTopic`.
2. Ahora: solo se renderizan/actualizan los controles de la lección activa.

### Evidencia versionada
1. iOS PR `#22` -> merge `53f1f38`.
2. Android PR `#19` -> merge `54f1e4b`.
3. SDD PR `#20` -> merge `3bb22d4`.

### Verificación funcional
1. iOS/Android/SDD: `python3 -m py_compile scripts/build-html.py` -> PASS.
2. iOS/Android/SDD: `python3 scripts/build-html.py` -> PASS.
3. Hub: `./scripts/build-hub.sh --mode strict` -> PASS.
4. Hub: `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
5. Hub: `./scripts/smoke-hub-runtime.sh` -> OK.

### Resultado
Se mantiene comportamiento funcional de navegación de lecciones con menor trabajo de DOM por transición de tema.

## Cierre Fase 6 (diferido de panel de índice a idle)
### Fecha
2026-03-01

### Contexto
Se retiró del path crítico de arranque la inicialización de `study-ux-index-actions`:
1. Inicialización en `requestIdleCallback` con `timeout`.
2. Fallback en `setTimeout` para navegadores sin `requestIdleCallback`.
3. Sin cambios funcionales en acciones de progreso/estadísticas/export/import/reset.

### Evidencia versionada
1. iOS PR `#23` -> merge `17083a7`.
2. Android PR `#20` -> merge `78df99f`.
3. SDD PR `#21` -> merge `7972e52`.

### Verificación funcional
1. iOS/Android/SDD: `py_compile` + `build-html` -> PASS.
2. Hub: `./scripts/build-hub.sh --mode strict` -> PASS.
3. Hub: `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
4. Hub: `./scripts/smoke-hub-runtime.sh` -> OK.

### Resultado
Arranque más liviano en móvil al diferir panel secundario sin degradar la UX funcional del curso.

## Cierre Fase 7 (badges del índice: idle global + update inmediato por tópico)
### Fecha
2026-03-01

### Contexto
Se optimizó la decoración de badges (`✓` completado, `🔁` repaso) en `study-ux.js`:
1. enlaces del índice indexados por `topicId`,
2. decoración global diferida a `idle`,
3. interacción de toggle actualiza solo el tópico afectado.

### Evidencia versionada
1. iOS PR `#24` -> merge `b8fbe02`.
2. Android PR `#21` -> merge `5164038`.
3. SDD PR `#22` -> merge `0cf3d0d`.

### Verificación funcional
1. iOS/Android/SDD: `py_compile` + `build-html` -> PASS.
2. Hub: `./scripts/build-hub.sh --mode strict` -> PASS.
3. Hub: `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
4. Hub: `./scripts/smoke-hub-runtime.sh` -> OK.

### Resultado
Menor trabajo de recorrido de enlaces en arranque y en toggles, manteniendo feedback visual inmediato para el usuario.

## Cierre Fase 8 (optimización de imágenes de arquitectura iOS para móvil)
### Fecha
2026-03-01

### Contexto
Se optimizó la entrega de diagramas pesados de iOS usados en `ETAPA 0`:
1. Nuevas variantes `webp` para:
   - `architecture-ios-core-mobile`
   - `architecture-ios-login-detail-v3`
   - `architecture-ios-catalog-detail-v4`
2. Render en builder con `<picture>` (source `webp` + fallback `png`) para reducir bytes en iPhone manteniendo compatibilidad.
3. Limpieza de `dist/assets` en cada build para eliminar residuos obsoletos y evitar drift por arrastre.

### Evidencia versionada
1. iOS PR `#25` -> merge `9c51915`.

### Verificación funcional
1. iOS: `python3 -m py_compile scripts/build-html.py` -> PASS.
2. iOS: `python3 scripts/build-html.py` -> PASS.
3. Hub: `./scripts/build-hub.sh --mode strict` -> PASS.
4. Hub: `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
5. Hub: `./scripts/smoke-hub-runtime.sh` -> OK.

### Resultado
Menor peso de descarga de diagramas críticos en iOS móvil sin regresión funcional en apertura de cursos ni en runtime del Hub.

## Publicación Fase 8 en Vercel
### Fecha
2026-03-01

### Evidencia de despliegue
1. Deployment: `https://architecture-stack-gflts3pkz-merlosalbarracins-projects.vercel.app`
2. Alias productivo: `https://architecture-stack.vercel.app`

### Verificación de rutas públicas
1. `https://architecture-stack.vercel.app/` -> `200`
2. `https://architecture-stack.vercel.app/ios/` -> `200`
3. `https://architecture-stack.vercel.app/android/` -> `200`
4. `https://architecture-stack.vercel.app/sdd/` -> `200`

### Resultado
Bloque Fase 8 publicado en productivo sin regresión de arranque ni navegación entre cursos.

## Fix UX móvil — Dropdown de cursos visible sobre topbar
### Fecha
2026-03-01

### Contexto
En móvil, el menú desplegable de cursos quedaba recortado y obligaba a scroll dentro de la topbar.
Se corrigió en iOS/Android/SDD:
1. `global-topbar` deja de recortar overlays.
2. `#course-switcher` vuelve a contexto `position: relative` con `z-index` superior.
3. `#course-switcher-menu` se renderiza por encima del resto de controles.

### Evidencia versionada
1. iOS PR `#26` -> merge `5b23493`.
2. Android PR `#22` -> merge `e161716`.
3. SDD PR `#23` -> merge `c713e71`.

### Verificación funcional
1. Hub: `./scripts/build-hub.sh --mode strict` -> PASS.
2. Hub: `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
3. Hub: `./scripts/smoke-hub-runtime.sh` -> OK.

### Resultado
El selector de cursos vuelve a desplegar completo y legible en móvil, sin clipping en topbar.

## Regresión post-bloque cloud progress sync (opción 2)
### Fecha
2026-03-01

### Contexto
Se implementó persistencia cloud de progreso para evitar dependencia exclusiva de `localStorage` por origen Vercel.

### Cambios aplicados
1. Hub:
   - nuevo endpoint `api/progress-sync.js`.
   - nuevas rutas publicadas por rewrite: `/progress/config`, `/progress/state`.
   - test de contrato: `scripts/tests/test-progress-sync.js`.
2. Cursos (`ios/android/sdd`):
   - `assets/study-ux.js` con sync híbrido (`localStorage` inmediato + push/pull cloud en background).
   - campos sincronizados: `completed`, `review`, `lastTopic`, `stats`, `zen`, `fontSize`.
   - reset/import con push forzado para evitar rollback de estado por pull remoto.

### Evidencia técnica
1. Hub tests:
   - `node --test scripts/tests/test-assistant-bridge-byok.js scripts/tests/test-progress-sync.js` -> PASS.
2. Rebuild cursos fuente:
   - `python3 scripts/build-html.py` en iOS/Android/SDD -> PASS.
3. Validación Hub:
   - `./scripts/build-hub.sh --mode strict` -> PASS.
   - `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
   - `./scripts/smoke-hub-runtime.sh` -> OK.

### Resultado
Sin regresión de arranque ni de rutas de cursos. Queda habilitada persistencia cloud cuando el backend está configurado; en entornos sin backend configurado se mantiene fallback seguro en `localStorage`.

### Publicación de cierre
1. PRs mergeadas a `develop`:
   - iOS `#28`
   - Android `#24`
   - SDD `#25`
   - Hub `#56`
2. Deploy productivo:
   - `https://architecture-stack-787gl8cx3-merlosalbarracins-projects.vercel.app`
   - alias: `https://architecture-stack.vercel.app`
3. Rutas verificadas en `200`:
   - `/`
   - `/ios/`
   - `/android/`
   - `/sdd/`

## Ajuste de smoke público 2026-03-08

### Contexto
El smoke público funcional seguía esperando una CTA legacy de Hub (`cuenta y sincronización`) como enlace HTML directo, pero el Hub actual ya no publica esa acción de esa forma.

### Cambios aplicados
1. `scripts/smoke-public-functional.sh` deja de exigir `href="./auth/index.html"` en la landing.
2. La validación se alinea con el comportamiento real:
   - enlaces visibles a cursos,
   - soporte de ruta `auth/login`,
   - páginas `auth/*` públicas verificables por separado.

### Resultado
Se elimina un falso negativo en post-deploy checks sin relajar cobertura real del flujo público.

## Endurecimiento suite pública 2026-03-08

### Cambios aplicados
1. `scripts/smoke-public-routes.sh`, `scripts/smoke-public-functional.sh` y `scripts/post-deploy-checks.sh` normalizan `BASE_URL` con o sin `/` final.
2. `scripts/smoke-public-functional.sh` usa comprobaciones más estables en Auth por `id` en vez de texto visible.
3. `scripts/post-deploy-checks.sh` permite inyección de comandos para pruebas aisladas.
4. Nuevo test `scripts/tests/test-public-smoke-suite.sh` añadido a `scripts/run-closeout-qa-suite.sh`.

### Evidencia técnica
1. `./scripts/tests/test-public-smoke-suite.sh` -> PASS.
2. `./scripts/post-deploy-checks.sh https://architecture-stack.vercel.app/` -> PASS.

## Endurecimiento suite local/runtime 2026-03-08

### Cambios aplicados
1. `scripts/smoke-hub-runtime.sh` soporta:
   - puerto libre real por `python3`,
   - override de `assistant-bridge` por entorno,
   - comando de servidor inyectable,
   - skip opcional de `npm install`.
2. `scripts/deploy-and-verify-closeout.sh` normaliza `BASE_URL` con o sin slash final.
3. Nuevo test `scripts/tests/test-smoke-hub-runtime.sh`.
4. `scripts/run-closeout-qa-suite.sh` incorpora el test de runtime local en la suite por defecto.

### Evidencia técnica
1. `./scripts/tests/test-smoke-hub-runtime.sh` -> PASS.
2. `./scripts/tests/test-deploy-and-verify-closeout.sh` -> PASS.
3. `./scripts/run-closeout-qa-suite.sh tests` -> PASS.
4. `./scripts/smoke-hub-runtime.sh` -> PASS.


## Endurecimiento curricular + Mermaid 2026-03-08

### Cambios aplicados
1. Nuevo orquestador `scripts/validate-course-content-and-mermaid.sh` para ejecutar gates curriculares de iOS, Android y SDD desde el Hub.
2. Nuevo validador `scripts/validate-hub-mermaid-runtime.mjs` que audita el HTML final publicado del Hub y comprueba:
   - leyenda Mermaid en SVG real,
   - ausencia de markup legacy `<i class="sma-arrow">`,
   - ausencia de tokens conflictivos `-.o/--o` en flowcharts publicados,
   - parse real en navegador headless con Mermaid 10 sobre los tres cursos.
3. Nuevo test `scripts/tests/test-course-content-mermaid-suite.sh` añadido a `scripts/run-closeout-qa-suite.sh`.

### Evidencia técnica
1. `./scripts/validate-course-content-and-mermaid.sh` -> PASS.
2. `./scripts/tests/test-course-content-mermaid-suite.sh` -> PASS.
3. `./scripts/run-closeout-qa-suite.sh tests` -> PASS.
4. Cobertura Mermaid publicada validada:
   - iOS: `232` bloques (`157` únicos)
   - Android: `28` bloques (`21` únicos)
   - SDD: `172` bloques (`169` únicos)


## Corrección publish/public profile SDD 2026-03-08

### Causa raíz
1. `scripts/build-hub.sh` en modo `fast` llamaba al builder SDD sin propagar `SMA_SDD_BUILD_PROFILE`, por lo que el builder usaba `full` y publicaba contenido interno (`00-informe`, `docs`, `openspec`).
2. El copy del hub también eliminaba `sdd/.gitignore` en cada regeneración.

### Cambios aplicados
1. `build-hub.sh` propaga `SMA_BUILD_PROFILE="$SDD_BUILD_PROFILE"` también en `fast`.
2. `validate-hub-mermaid-runtime.mjs` ahora bloquea publicación de rutas internas SDD en el HTML final.
3. El copy del hub preserva `.gitignore` en `hub/sdd` igual que ya podía preservar `assistant-panel.js`.

### Evidencia técnica
1. `./scripts/build-hub.sh --fast` -> SDD `Perfil de build: public`.
2. `sdd/index.html` y `sdd/curso-stack-my-architecture-sdd.html` sin `data-lesson-path="00-informe/|docs/|openspec/`.
3. `./scripts/validate-course-content-and-mermaid.sh` -> PASS.


## Sincronización incremental Android 2026-03-08

### Cambios aplicados
1. Se resincroniza el HTML publicado de Android tras reconciliar el estado real del curso con el proyecto ejecutable.
2. La lección `01-junior/00-introduccion.md` deja de declarar un estado obsoleto (`9 unit tests + 3 integration tests`) y pasa a reflejar evidencia real actual: pruebas unitarias/sync y `4` tests UI Compose.

### Evidencia técnica
1. `python3 scripts/build-html.py` en `stack-my-architecture-android` -> PASS (`80 archivos`, `1350 KB`).
2. `./scripts/build-hub.sh --fast` -> PASS.
3. Diff del hub acotado a:
   - `android/index.html`
   - `android/curso-stack-my-architecture-android.html`


## Endurecimiento auth-bound cloud progress 2026-03-08

### Cambios aplicados
1. `api/progress-sync.js` deja de confiar en `profileKey` enviado por cliente y lo deriva del usuario autenticado vía bearer token.
2. La config pública de progreso expone `requiresAuth` para que el runtime pueda degradar correctamente sin sync cloud cuando no hay sesión.
3. `study-ux.js` en iOS/Android/SDD deja de filtrar `progressProfile` en la URL cuando el progreso va ligado a cuenta.
4. El CTA de sincronización pasa de “enlace compartible” a semántica de cuenta cloud.
5. Nueva regresión automatizada en QA:
   - `scripts/tests/test-auth-and-progress-api-suite.sh`
   - incluida en `scripts/run-closeout-qa-suite.sh`

### Evidencia técnica
1. `node --test scripts/tests/test-progress-sync.js` -> PASS.
2. `./scripts/tests/test-auth-and-progress-api-suite.sh` -> PASS.
3. `./scripts/build-hub.sh --fast` -> PASS.
4. Validación real de acceso anónimo sobre host no local:
   - `http://127.0.0.1.nip.io:4173/ios/index.html`
   - redirección observada a `auth/login.html?next=%2Fios%2Findex.html`


## E2E autenticada cross-device 2026-03-08

### Cambios aplicados
1. Nuevo test opt-in `scripts/tests/test-authenticated-progress-cross-device.sh`.
2. La E2E usa dos sesiones Playwright aisladas (`device-a`, `device-b`) y valida el flujo real:
   - login con cuenta autenticada,
   - marcar completado y repaso en `device-a`,
   - abrir el mismo curso en `device-b`,
   - comprobar que el progreso cloud se refleja,
   - restaurar el estado original de la lección para no dejar residuos en la cuenta de prueba.
3. `scripts/run-closeout-qa-suite.sh` incorpora la nueva E2E en la suite por defecto.
4. La ejecución queda en modo `SKIP` limpio si faltan credenciales reales:
   - `SMA_E2E_AUTH_EMAIL`
   - `SMA_E2E_AUTH_PASSWORD`
   - opcional: `SMA_E2E_BASE_URL`, `SMA_E2E_COURSE_PATH`, `SMA_E2E_TOPIC_ID`

### Evidencia técnica
1. `bash -n scripts/tests/test-authenticated-progress-cross-device.sh` -> PASS.
2. `./scripts/tests/test-authenticated-progress-cross-device.sh` -> SKIP controlado sin credenciales.
3. `./scripts/run-closeout-qa-suite.sh tests` -> PASS con la nueva regresión integrada.

## E2E autenticada ejecutada en producción 2026-03-08

### Cambios aplicados
1. Se corrigió una regresión de runtime en `study-ux.js` de iOS y Android: un bloque duplicado dentro de `hydrateTopicLessonLabels` lanzaba `ReferenceError: topic is not defined` y abortaba parte de la hidratación de la UI de estudio.
2. Se endureció `scripts/tests/test-authenticated-progress-cross-device.sh` para el wrapper Playwright real:
   - bootstrap fiable tras `delete-data`,
   - renderizado seguro de snippets JS,
   - parser robusto de `### Result`,
   - lectura de auth desde `localStorage`,
   - capturas sin `require("path")`.
3. Se redeployó el Hub en Vercel con los assets corregidos.

### Evidencia técnica
1. `./scripts/publish-architecture-stack.sh fast` -> deploy OK.
2. Alias activo verificado:
   - `https://architecture-stack.vercel.app/`
   - `https://architecture-stack.vercel.app/ios/`
   - `https://architecture-stack.vercel.app/android/`
   - `https://architecture-stack.vercel.app/sdd/`
3. `./scripts/tests/test-authenticated-progress-cross-device.sh` con credenciales reales -> PASS.
4. Flujo validado en producción:
   - login real,
   - marcado `completado + repaso` en `device-a`,
   - lectura sincronizada en `device-b`,
   - restauración final del estado original.

## CI GitHub Actions — E2E auth production 2026-03-08

### Cambios aplicados
1. Nuevo workflow versionado:
   - `.github/workflows/hub-production-auth-e2e.yml`
2. Nueva implementación CI-friendly sin dependencia del wrapper local de Codex:
   - `scripts/tests/run-authenticated-progress-cross-device-ci.cjs`
3. El workflow:
   - instala `playwright@1.52.0` en `.runtime/playwright-runner`,
   - descarga `chromium`,
   - ejecuta la E2E real contra producción,
   - sube artefactos en `output/playwright-ci-auth-e2e`.
4. Secretos dedicados previstos para el repo:
   - `SMA_E2E_AUTH_EMAIL`
   - `SMA_E2E_AUTH_PASSWORD`
5. Trigger operativo activo:
   - `push` a `develop` cuando cambian auth/progreso/runtime o la propia E2E.
6. `workflow_dispatch` y `schedule` quedan versionados, pero GitHub solo permitirá lanzarlos directamente cuando el workflow exista también en la rama por defecto (`main`).
7. El workflow usa los defaults del runner CI para `baseUrl`, `coursePath`, `courseId` y `topicId`, evitando expresiones dinámicas frágiles en `push`.

### Evidencia técnica
1. `node --check scripts/tests/run-authenticated-progress-cross-device-ci.cjs` -> PASS.
2. Validación YAML del workflow -> PASS.
3. Ejecución local del runner CI con `NODE_PATH=.runtime/playwright-runner/node_modules` -> PASS.
4. Workflow publicada y trigger automático sobre `develop` verificado.
5. Ejecución en GitHub Actions intentada:
   - run `22827196688`
   - estado real: `failure`
   - causa operativa externa: `The job was not started because your account is locked due to a billing issue.`

## Parking operativo 2026-03-08 — workflow CI aparcado por no disponer de billing

### Cambios aplicados
1. El workflow de GitHub Actions queda aparcado fuera de `.github/workflows/` para evitar fallos automáticos en cada push:
   - `.github/workflows-disabled/hub-production-auth-e2e.yml`
2. Se conserva intacto el runner CI:
   - `scripts/tests/run-authenticated-progress-cross-device-ci.cjs`
3. La validación manual/local sigue siendo la vía activa mientras no haya billing en GitHub Actions.

### Criterio operativo
1. No reactivar el workflow mientras la cuenta siga bloqueada para `Actions`.
2. Para reactivarlo en el futuro basta con devolver el archivo a:
   - `.github/workflows/hub-production-auth-e2e.yml`
3. No hace falta rehacer código ni secretos; solo restaurar el archivo a su carpeta activa y relanzar el run.

## 2026-03-08 — Limpieza enterprise de artefactos de seguimiento
- Se consolida la política de documentación estable del ecosistema.
- El Hub deja como fuente de verdad solo `MASTER TRACKER`, `SESSION HANDOFF`, `HUB STABILITY LOG` y `ADR-LITE`.
- Los cursos pasan a publicar únicamente documentación estable para alumno y operación (`INFORME`, `MATRIZ`, `RUBRICA`, `SCORECARD`).

## 2026-03-09 — QA endurecida para modo entrevista mientras Vercel sigue bloqueado

### Cambios aplicados
1. Nuevo smoke automatizado para `modo entrevista`:
   - `scripts/tests/run-interview-mode-smoke.cjs`
   - `scripts/tests/test-interview-mode-smoke.sh`
2. La suite estándar del Hub integra ya esta regresión:
   - `scripts/run-closeout-qa-suite.sh`
3. El smoke valida en servidor local temporal:
   - Hub con accesos `Modo entrevista` visibles en catálogo
   - `iOS` en móvil (`390x844`)
   - `Android`
   - `SDD`
4. Se evita la fragilidad del wrapper Playwright shell usando `playwright` directo desde `.runtime/playwright-runner`.

### Evidencia técnica
1. `./scripts/tests/test-interview-mode-smoke.sh` -> PASS.
2. `./scripts/run-closeout-qa-suite.sh tests` -> PASS con el smoke nuevo integrado.
3. El despliegue sigue bloqueado solo por Vercel:
   - `api-deployments-free-per-day`


## 2026-03-09 — Ventana de redeploy programada por cooldown de Vercel

### Estado operativo
1. `./scripts/deploy-and-verify-closeout.sh fast` refrescó el cooldown real de Vercel.
2. Ventana estimada de reapertura registrada:
   - `2026-03-09 03:46:49 CET`
3. Cola automática programada:
   - job principal `21` -> `03:47`
   - watchdog `22` -> `03:49`
   - followup `23` -> `03:51`
4. Validación operativa:
   - `./scripts/closeout-status.sh` -> `EN ESPERA`
   - `./scripts/closeout-readiness.sh` -> `EN ESPERA`
5. No se aplican cambios de código en este paso; es cierre operativo usando la infraestructura de cooldown ya existente.

## 2026-03-09 — Guardarrail de publicacion durante cooldown de Vercel

### Contexto
Tras dejar programada la ventana automática de redeploy, seguía existiendo el riesgo operativo de que un `./scripts/publish-architecture-stack.sh fast` manual intentara publicar antes de tiempo y consumiera cuota innecesariamente.

### Cambios aplicados
1. `scripts/publish-architecture-stack.sh` ahora lee el cooldown activo y bloquea el deploy mientras siga vigente.
2. Se añade bypass explícito solo para casos de emergencia:
   - `SMA_DEPLOY_FORCE=1 ./scripts/publish-architecture-stack.sh fast`
3. Nueva regresión automática:
   - `scripts/tests/test-publish-architecture-stack.sh`
4. La nueva regresión queda integrada en:
   - `./scripts/run-closeout-qa-suite.sh tests`

### Evidencia técnica
1. `./scripts/tests/test-publish-architecture-stack.sh` -> PASS.
2. `./scripts/run-closeout-qa-suite.sh tests` -> PASS.
3. Prueba operativa real:
   - `./scripts/publish-architecture-stack.sh fast` -> guard activo, `EXIT_CODE=2`
   - no intenta publicar antes de `2026-03-09 03:46:49 CET`

### Resultado
La infraestructura de closeout queda mejor protegida: durante el cooldown, la publicación manual ya no puede malgastar cuota por error humano y el flujo correcto pasa a ser esperar la ventana automática programada.

## Hotfix notas privadas `Supabase 403`
### Fecha
2026-03-14

### Síntoma
En el runtime de curso, el panel `Notas privadas por lección` devolvía `Supabase respondió 403.` al intentar guardar una nota autenticada.

### Diagnóstico
1. `hub_student_notes` y `hub_student_bookmarks` dependían de la configuración SQL base, pero el contrato versionado no dejaba explícitos los `GRANT` para `service_role`.
2. Cuando PostgREST denegaba acceso a esas tablas, el Hub propagaba un error opaco (`403`) sin guía operativa.
3. El mismo riesgo afectaba a bookmarks porque comparten el mismo patrón backend.

### Cambios aplicados
1. `docs/PROGRESS-SYNC-SUPABASE.sql` ahora concede explícitamente `USAGE` sobre `public` y `SELECT/INSERT/UPDATE/DELETE` a `service_role` en `course_progress`, roles, entitlements, teasers, notes, bookmarks y audit log.
2. `api/student-notes.js` y `api/student-bookmarks.js` traducen fallos de permisos o tablas ausentes a un error de infraestructura accionable (`503`) con referencia directa a `docs/PROGRESS-SYNC-SUPABASE.sql`.
3. Nuevas regresiones automáticas:
   - `scripts/tests/test-student-notes.js`
   - `scripts/tests/test-student-bookmarks.js`

### Evidencia técnica
1. `node --test scripts/tests/test-student-notes.js` -> PASS.
2. `node --test scripts/tests/test-student-bookmarks.js` -> PASS.
3. `./scripts/build-hub.sh --mode strict` -> PASS.

### Estado
Hotfix publicado en Vercel, migración Supabase aplicada y guardarraíl backend endurecido.

### Evidencia operativa final
1. Deploy de producción activo: `https://architecture-stack.vercel.app`.
2. Alias Vercel confirmado: `https://stack-my-architecture-hub.vercel.app`.
3. Grants verificados con SQL: `hub_student_notes`, `hub_student_bookmarks`, `hub_course_entitlements` y `public` -> OK.
4. `./scripts/post-deploy-checks.sh https://architecture-stack.vercel.app` -> PASS.

## Hotfix UX teaser: progreso y navegación final
### Fecha
2026-03-14

### Síntoma
En modo `teaser`, el runtime mostraba `Progreso: X/Y` como si fuera progreso del curso completo y el botón `Siguiente lección` quedaba desactivado al completar la última lección visible, dando sensación de bug.

### Diagnóstico
1. El gating `teaser` poda `topics` a las lecciones visibles, por lo que el progreso se calculaba sobre la muestra y no sobre el curso completo.
2. La navegación final reutilizaba la misma lógica que el acceso completo y dejaba el botón desactivado en la última lección teaser en vez de guiar al usuario hacia el desbloqueo.

### Cambios aplicados
1. `study-ux.js` publicado en `ios`, `android` y `sdd` etiqueta el progreso teaser como `Muestra: X/Y lecciones teaser`.
2. En la última lección visible del teaser, el botón final pasa a `🔐 Desbloquear curso` y revela el gate de acceso en vez de quedar muerto.
3. Se expone `revealGate()` desde el control de acceso para reutilizar el CTA sin duplicar lógica.

### Estado
Hotfix listo para publicación.

## Hotfix UX bookmarks, cache y modo claro
### Fecha
2026-03-14

### Síntoma
1. El botón `Guardar bookmark` cambiaba estado interno, pero no daba feedback visible al usuario y, si fallaba, parecía que no había hecho nada.
2. En navegación normal el navegador seguía mostrando HTML cacheado y obligaba a abrir los cursos en incógnito para ver cambios recientes.
3. El panel de `Modo entrevista` en tema claro reutilizaba superficies oscuras fijas y perdía legibilidad.

### Cambios aplicados
1. `study-ux.js` publicado en `ios`, `android` y `sdd` añade estado textual para bookmarks:
   - confirma guardado o eliminación
   - muestra mensaje guía cuando aún no hay bookmarks
   - expone error visible si la actualización falla
2. `vercel.json` vuelve a publicar cabeceras `Cache-Control: no-store` para rutas estáticas, evitando que el HTML quede pegado en navegador tras un deploy.
3. `study-ux.css` publicado en `ios`, `android` y `sdd` sustituye fondos oscuros fijos del panel de entrevista por superficies basadas en variables del tema, mejorando contraste en modo claro.

### Estado
Hotfix validado en build strict. Pendiente de verificación visual tras publicación.

## Hotfix Mermaid modo claro: contraste de nodos y bordes
### Fecha
2026-03-14

### Sintoma
En tema claro, varios diagramas Mermaid quedaban con cajas y diamantes demasiado lavados, especialmente en flowcharts de decision, haciendo que parecieran invisibles aunque en modo oscuro se vieran bien.

### Diagnostico
1. El palette light de `theme-controls.js` estaba heredando un `--border` demasiado suave para SVGs complejos.
2. Los overrides SVG reforzaban texto, flechas y labels, pero no todos los nodos y contenedores de Mermaid (`.label-container`, diamantes, clusters y `flowchart-link`).
3. El problema afectaba a `ios`, `android` y `sdd` porque comparten el mismo runtime tematico.

### Cambios aplicados
1. `assets/theme-controls.js` en `ios`, `android` y `sdd` refuerza el palette Mermaid en claro:
   - fondo del diagrama mas definido
   - fondo de nodo ligeramente tintado
   - borde de nodo con contraste alto
   - lineas con azul mas estable
2. `applyMermaidSvgOverrides()` ahora cubre tambien:
   - `.node rect`, `.node polygon`, `.node circle`, `.node ellipse`, `.node path`
   - `.label-container`, `.cluster rect`, `.actor`, `.labelBox`
   - `.flowchart-link`
3. `scripts/patch-study-ux-runtime.py` incorpora este hotfix para que sobreviva a futuros `build-hub` aunque los HTML se vuelvan a copiar desde los repos fuente.

### Evidencia tecnica
1. `./scripts/build-hub.sh --mode strict` -> PASS.
2. Validacion Playwright local sobre `ios/index.html#05-maestria-01-isolation-domains` en tema claro -> nodos y diamantes con borde y superficie visibles.

### Estado
Hotfix listo para publicacion.

## Hotfix notas privadas: fallback a anon key + RLS autenticado
### Fecha
2026-03-14

### Sintoma
Las notas privadas mostraban `Supabase está denegando acceso a las notas privadas...` al pulsar `Guardar nota`, aunque el usuario ya estaba autenticado en producción.

### Diagnostico
1. El proyecto Vercel real `architecture-stack` tenía `SUPABASE_SERVICE_ROLE_KEY`, pero esa key era inválida para el proyecto Supabase configurado en `SUPABASE_URL`.
2. `student-notes` y `student-bookmarks` dependían todavía de la infraestructura server-side basada en `service_role`.
3. Para estas dos capacidades no hacía falta `service_role`: bastaba el JWT del usuario autenticado con políticas RLS correctas.

### Cambios aplicados
1. `api/_hub-platform.js` añade soporte explícito a `SUPABASE_ANON_KEY` y peticiones user-scoped con `apikey + bearer token`.
2. `api/student-notes.js` y `api/student-bookmarks.js` dejan de depender de `resolveUserContext` para persistencia y pasan a resolver solo el usuario autenticado.
3. `docs/PROGRESS-SYNC-SUPABASE.sql` versiona grants y policies RLS para `authenticated` sobre:
   - `public.hub_student_notes`
   - `public.hub_student_bookmarks`
4. Se aplica la migración real en Supabase.
5. Se añade `SUPABASE_ANON_KEY` al proyecto Vercel real `architecture-stack`.

### Evidencia tecnica
1. `node --test scripts/tests/test-student-notes.js scripts/tests/test-student-bookmarks.js` -> PASS.
2. `./scripts/build-hub.sh --mode strict` -> PASS.
3. La key previa de `SUPABASE_SERVICE_ROLE_KEY` respondía `Invalid API key` contra `rest/v1/hub_student_notes`.

### Evidencia en produccion
1. Deploy real publicado en `https://architecture-stack.vercel.app`.
2. `POST /api/student-notes?route=upsert` con cuenta autenticada real -> `ok: true`.
3. `GET /api/student-notes?route=list&courseId=ios` devuelve la nota recién guardada.
4. `POST /api/student-bookmarks?route=toggle` con cuenta autenticada real -> `ok: true`, `active: true`.
5. Limpieza de QA ejecutada al final:
   - nota eliminada
   - bookmark desactivado

### Estado
Hotfix publicado y verificado en producción.
