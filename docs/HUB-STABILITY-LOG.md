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
