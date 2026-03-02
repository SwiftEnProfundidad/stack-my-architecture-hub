# SESSION HANDOFF

Fecha de corte: 2026-03-02

## Leyenda
- ✅ Hecho
- 🚧 En construccion (maximo 1)
- ⏳ Pendiente
- ⛔ Bloqueado

## Estado actual
Workspace unificado en:
`/Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture`

Repos incluidos:
1. `stack-my-architecture-hub`
2. `stack-my-architecture-SDD`
3. `stack-my-architecture-ios`
4. `stack-my-architecture-android`

## Último hito cerrado
1. Hub estabilizado y funcional para abrir cursos.
2. Commit: `1940c7d`
3. Tag: `hub-stable-20260224`

## Último bloque operativo cerrado
1. Bloque empleabilidad + rigor enterprise cerrado end-to-end.
2. Acción aplicada:
   - iOS/Android/SDD incorporan baseline comun:
     - `00-informe/MATRIZ-COMPETENCIAS.md`
     - `00-informe/RUBRICA-GATES-POR-FASE.md`
     - `00-informe/SCORECARD-EMPLEABILIDAD.md`
   - iOS/Android/SDD incorporan validadores:
     - `scripts/validate-learning-gates.py`
     - `scripts/validate-diagram-semantics.py`
   - Hub incorpora:
     - `docs/archive/plans-closed/PLAN-MAESTRO-IMPLEMENTACION-CURSOS-20260227.md`
     - `docs/GUIA-DIAGRAMAS-ARQUITECTURA-CAPAS-Y-FLECHAS.md`
     - `docs/TEMPLATE-DIAGRAMA-ARQUITECTURA-MERMAID.md`
   - sync selectivo de bundles (`ios/android/sdd`) y validacion runtime del Hub.
   - ciclo RED-GREEN-REFACTOR aplicado:
     - RED: `build-hub --strict` falla por gate pedagogico en nuevos documentos SDD.
     - GREEN: se anaden Mermaid + snippet no-Mermaid en los 3 documentos nuevos de SDD.
     - REFACTOR: validadores de semantica Mermaid quedan calibrados con deteccion exacta de `-.->`.
   - validacion final en verde de repos fuente + Hub strict.
3. Evidencia versionada:
   - iOS PR `#12` -> merge `2767696`.
   - Android PR `#9` -> merge `483744f`.
   - SDD PR `#10` -> merge `6c2fa09`.
   - Hub PR `#33` -> merge `079bfbb`.
   - Hub PR `#36` -> merge `c0b65a5` (inventario + matriz de brechas).
   - iOS PR `#13` -> merge `1fbb0c8` (cierre de brechas accionables en lecciones).
   - Android PR `#10` -> merge `d183d1e` (cierre de brechas accionables en lecciones).
   - SDD PR `#11` -> merge `aa1e4cf` (auditoría plan maestro).
   - SDD PR `#12` -> merge `7deaa30` (fix validador pedagógico en informe).
   - iOS PR `#14` -> merge `e2a2e91` (reparación visual Mermaid post-cierre).
   - Android PR `#11` -> merge `03db5b8` (reparación visual Mermaid post-cierre).
   - iOS PR `#15` -> merge `2208297` (diagrama por capas migrado a SVG estilo mock).
   - Android PR `#12` -> merge `3896bad` (diagrama por capas migrado a SVG estilo mock).
   - SDD PR `#13` -> merge `0338ba9` (week16 con diagrama por capas SVG estilo mock).
   - Hub sync bundles -> commit `06ab4cc` (ios/android/sdd) en `chore/hub-sync-svg-architecture-20260227`.
4. Política operativa vigente:
   - no abrir una nueva task en `🚧` sin trigger real (merge fuente, drift detectado o instrucción explícita).
5. Última evidencia técnica consolidada:
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
   - Hub:
     - `./scripts/build-hub.sh --mode strict` -> PASS.
     - `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
     - `./scripts/smoke-hub-runtime.sh` -> OK.
     - carga de Mermaid/Highlight desacoplada del `<head>` en iOS/Android/SDD (runtime loader bajo demanda, no bloqueante para arranque inicial).
     - corrección Mermaid post-cierre validada visualmente con Playwright (sin `Syntax error in text` en muestra iOS).
     - arquitectura por capas SVG (estilo mock) sincronizada para iOS/Android/SDD con build strict en verde.
     - refinamiento visual determinista del SVG iOS (Lección 1: Core Mobile Architecture) validado con Playwright:
       - `Composition / App Shell` separado bajo `Application`.
       - ruteo ortogonal de flechas (runtime/wiring/contrato/salida) sin puntas descentradas.
       - labels y cajas recalibrados para evitar clipping.
     - optimización de payload de diagramas iOS para móvil:
       - `picture` con `webp` + fallback `png` para `core/login/catalog` en `ETAPA 0`.
       - limpieza de `dist/assets` por build para evitar residuos de assets obsoletos.
     - despliegue Vercel productivo completado:
       - deployment: `https://architecture-stack-gflts3pkz-merlosalbarracins-projects.vercel.app`
       - alias: `https://architecture-stack.vercel.app`
       - rutas en `200`: `/`, `/ios/`, `/android/`, `/sdd/`.
     - asserts runtime en smoke:
       - `/ios/assets/assistant-panel.js` contiene `KEY_PROVIDER` o `KEY_DAILY_BUDGET`.
       - `/android/assets/assistant-panel.js` contiene `KEY_PROVIDER` o `KEY_DAILY_BUDGET`.
       - `/sdd/assets/assistant-panel.js` contiene `KEY_PROVIDER` o `KEY_DAILY_BUDGET`.

## Último bloque operativo ejecutado
1. Fase 4 de hardening runtime móvil aplicada en iOS/Android/SDD + sync Hub.
2. Cambios ejecutados:
   - `assistant-panel.js` diferido bajo interacción (lazy-load desde `assistant-bridge.js`).
   - eliminación de llamadas `/health` en arranque en frío.
   - sincronización de `assistant-panel.js` fuente->Hub sin preservación forzada.
   - ajuste de `build-hub.sh` para preservar panel solo en modo explícito (`PRESERVE_ASSISTANT_PANEL=1`).
   - renderizadores CDN de Mermaid/Highlight movidos a carga dinámica en runtime (iOS/Android/SDD), evitando bloqueo de `DOMContentLoaded` por red externa lenta.
   - modo compacto de controles de estudio en iPhone estrecho (`<=480px`) con etiquetas cortas (`✅ Hecho`, `🔁 Repaso`, `🧘 Zen`) manteniendo `aria-label` completo.
   - ajuste de espaciado/padding en topbar móvil para reducir ruido visual sin romper navegación.
   - micro-optimización de navegación de lección: `study-ux.js` deja de reconstruir nav para todas las lecciones y actualiza solo la lección activa.
   - diferir `study-ux-index-actions` a fase `idle` para reducir coste del primer render en móvil.
   - indexación de enlaces por `topicId` y decoración de badges global diferida a `idle`, con actualización inmediata del tópico afectado.
   - optimización de imágenes de arquitectura iOS para móvil (`webp` + fallback `png`) con limpieza determinista de `dist/assets`.
   - restauración del menú desplegable de cursos en topbar móvil (iOS/Android/SDD) para evitar clipping por `overflow` y mantener overlay visible sin scroll adicional.
3. Evidencia técnica:
   - `python3 scripts/build-html.py` en iOS/Android/SDD -> PASS.
   - `python3 -m py_compile scripts/build-html.py` en iOS/Android/SDD -> PASS.
   - `./scripts/build-hub.sh --mode strict` en Hub -> PASS.
   - `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
   - `./scripts/smoke-hub-runtime.sh` -> OK.
   - Playwright local:
     - carga inicial en `ios/android/sdd` sin requests `/health`.
     - apertura de asistente en `ios/android/sdd` sin requests `/health` automáticos.
     - validación viewport `390x844` en `ios/android/sdd` con topbar compacta estable y controles legibles.
   - validación final hub tras optimización:
     - `./scripts/build-hub.sh --mode strict` -> PASS
     - `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`
     - `./scripts/smoke-hub-runtime.sh` -> OK
4. Plan formal de continuidad:
   - `docs/archive/plans-closed/PLAN-PERFORMANCE-MOBILE-FIRST-20260301.md`

## Trabajo en curso
1. ✅ Fase 1 performance móvil cerrada.
2. ✅ Fase 2 mobile-first UX cerrada.
3. ✅ Fase 3 validación final + publicación cerrada.
4. ✅ Fase 4.5: pase responsive móvil final (iPhone viewport estrecho) en cursos + Hub.
5. ✅ Fase 5: micro-optimización del render de navegación de lección (solo tema activo).
6. ✅ Fase 6: diferir panel de acciones/estadísticas del índice a `idle` (sin cambio funcional).
7. ✅ Fase 7: optimización de badges del índice (idle global + update inmediato por tópico).
8. ✅ Fase 8: optimización de diagramas iOS para móvil (`webp` + fallback `png`) y sync Hub.
9. ✅ Fix UX móvil: dropdown de cursos vuelve a mostrarse por encima de la topbar sin recorte.
10. ✅ Bloque cloud progress sync (opción 2) cerrado:
   - backend Hub + sync híbrido iOS/Android/SDD en verde técnico;
   - cierre GitFlow completo y despliegue Vercel en producción:
     - `https://architecture-stack.vercel.app`
     - `https://architecture-stack-787gl8cx3-merlosalbarracins-projects.vercel.app`
11. ✅ Hotfix de continuidad multi-dispositivo y arranque Hub (2026-03-02):
   - `build-hub.sh`, `verify-hub-build.py` y `check-selective-sync-drift.sh` soportan rutas flat/nested para iOS/Android/SDD.
   - `study-ux.js` y `course-switcher.js` alineados en iOS/Android/SDD para:
     - resolver `/progress/*` contra endpoint remoto en contexto local,
     - conservar `progressProfile/progressBase/progressEndpoint` al cambiar de curso,
     - exponer acción `🔗 Copiar enlace de sincronización` para compartir progreso entre dispositivos.
   - validación en verde:
     - `python3 scripts/build-html.py` en iOS/Android/SDD -> PASS
     - `./scripts/build-hub.sh --mode fast` -> PASS
     - `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`
     - `./scripts/smoke-hub-runtime.sh` -> OK
12. 🚧 Nuevo ciclo activo de auditoria gradual por leccion:
   - plan activo unico: `docs/PLAN-AUDITORIA-CURSOS-FASES-20260302.md`
   - matriz operativa: `docs/AUDITORIA-CURSOS-MATRIZ-20260302.tsv`
   - `1.1` iOS `ETAPA 0: CORE MOBILE` cerrada en caliente (normalizacion de flechas, narrativa y jerarquia de encabezados).
   - `1.2` iOS `ETAPA 1: JUNIOR` cerrada en caliente (fences Mermaid, markers auto y convención de flechas alineados).
   - `1.3` iOS `ETAPA 2: MIDLEVEL` cerrada en caliente (fences Mermaid, markers auto y convención de flechas alineados).
   - `1.4` iOS `ETAPA 3: SENIOR` cerrada en caliente (fences Mermaid, markers auto y convención de flechas alineados).
   - `1.5` iOS `ETAPA 4: ARQUITECTO` cerrada en caliente (fences Mermaid, markers auto y convención de flechas alineados).
   - `1.6` iOS `ETAPA 5: MAESTRIA + ANEXOS` cerrada en caliente (fences Mermaid, markers auto y convención de flechas alineados).
   - `1.7` iOS `ETAPA 6: PROYECTO FINAL` cerrada con sección propia (`06-proyecto-final`) y rúbrica de entrega defendible.
   - `2.1` Android bloque inicial cerrado en caliente (`00-nivel-cero`, `00-core-mobile`) con convención de flechas alineada.
   - `2.2` Android bloque intermedio cerrado en caliente (`01-junior`, `02-midlevel`) con convención de flechas y fences Mermaid alineados.
   - `2.3` Android bloque avanzado cerrado en caliente (`03-senior`, `04-maestria`, `05-proyecto-final`, `anexos`) con convención de flechas alineada.
   - `2.4` Android Proyecto Final endurecido en caliente (brief/rúbrica/evidencias con criterio enterprise defendible).
   - `3.1` SDD bloque base cerrado en caliente (`00-preparacion`, `01-roadmap`, semanas 01-08) con cierre consistente de fences Mermaid.
   - `3.2` SDD bloque avanzado cerrado en caliente (semanas 09-16 con cierre consistente de fences Mermaid, anexos auditados sin regresión).
   - `3.3` perfil público monetizable SDD cerrado (build profile público excluye `00-informe`, `docs`, `openspec` sin romper perfil local full).
   - `3.4` Proyecto Final SDD obligatorio cerrado con sección pública dedicada (`18-proyecto-final`) y rúbrica de defensa.
   - `4.1` Hub UX/UI responsive cerrado en caliente con fix cross-course de controles móviles:
     - `#study-ux-controls` y `#theme-controls` ahora envuelven (`flex-wrap`) sin overflow horizontal.
     - `#study-progress` pasa a primera fila en `<=480px` para evitar clipping del botón `💬 Asistente IA`.
     - verificado en iOS/Android/SDD (`390x844`) con Playwright: sin desbordes de viewport.
   - `4.2` auth/logout/acceso cerrado en caliente:
     - logout limpia `sma:auth:user:v1`, `sma:auth:session:v1` y `sma:cloud:profile:v1`.
     - accesos directos sin sesión redirigen a login con `next` saneado (sin `progressProfile/progressBase/progressEndpoint`).
     - verificado en runtime: acceso bloqueado sin sesión y reentrada al curso exige login.
   - `4.3` validación visual cerrada en caliente:
     - Playwright en iOS/Android/SDD y viewports `desktop + iPhone`.
     - 3 estilos (`Enterprise/Bold/Paper`) ciclan correctamente en los 3 cursos.
     - sin overflow horizontal en body/controles y con toggle de índice visible en iPhone.
   - `5.1` QA técnico cross-repo cerrado en caliente:
     - Android: `check-links`, `validate-diagram-semantics`, `build-html` en verde.
     - SDD: estructura/OpenSpec/links/pedagogía/snippets/build/`swift test` en verde.
     - iOS: enlaces de arquitectura corregidos en `00-core-mobile/00-introduccion.md` y baseline de guardrails recalibrado al corpus auditado actual; `run-qa-audit-bundle.sh` en verde.
   - `5.2` GitFlow de cierre completado:
     - iOS PR `#38` mergeada (`fix(ios-qa): links intro + baseline guardrails`).
     - Hub PR `#80` mergeada (`sync bundles + tracking 5.1->5.2`).
     - `develop` limpio en los 4 repos.
   - `5.3` deploy final intentado y bloqueado por cuota Vercel:
     - comando: `bash scripts/publish-architecture-stack.sh fast`
     - error: `api-deployments-free-per-day` (retry en ~17h desde intento).
   - tarea en construccion actual: `0.3` (limpieza de planes historicos cerrados en `docs/`).

## Última comprobación de espera activa
1. Fecha: 2026-02-27.
2. `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
3. `./scripts/smoke-hub-runtime.sh` -> OK.
4. Resultado operativo: sin regresión runtime tras cobertura total de flechas Mermaid en iOS/Android/SDD.

## Tablero operativo (la unica en construccion vive en Master Tracker)
1. ✅ Publicación selectiva cross-course iOS + Android + SDD en Hub (`c9cd8c3`).
2. ✅ Tracking anti-bucle consolidado con última evidencia técnica válida de `2026-02-25 11:21 CET`.
3. ✅ Espera activa previa cerrada por consolidación anti-bucle (sin trigger técnico pendiente).
4. ✅ Standby operativo cerrado por trigger explícito para iniciar BYOK.
5. ✅ Cierre GitFlow BYOK multi-provider (push, PR y merge).
6. ✅ Standby operativo posterior al BYOK cerrado administrativamente.
7. ✅ Pendientes de higiene SDD cerrados.
8. ✅ Auditoría profunda de cursos cerrada (sin P0/P1 abiertos).
9. ✅ Calibración del validador pedagógico SDD cerrada en GitFlow.
10. ✅ Cierre de backlog iOS Mermaid semántica + publicación cross-course.
11. ✅ Cierre de backlog iOS trazabilidad scaffold + publicación selectiva de iOS.
12. ✅ Publicación productiva en Vercel sin regresión de BYOK multi-provider.
13. ✅ Corrección visual de leyenda Mermaid (flechas) en iOS/Android/SDD + sync selectivo estable en Hub.
14. ✅ Refuerzo pedagógico iOS: aplicación explícita de las 4 flechas Mermaid en lecciones de arquitectura de la app ejemplo.
15. ✅ Refuerzo pedagógico cross-course de semántica Mermaid (Android + SDD) + sync Hub.
16. ✅ Cobertura total Mermaid en iOS -> Android -> SDD + sync Hub y plan versionado.
17. ✅ Buscador lateral de lecciones en iOS/Android/SDD + sync selectivo Hub.
18. ✅ Fijar bloque `INDICE + buscador` al scroll y corregir separación superior para evitar clipping visual.
19. ✅ Blindar build/sync del Hub para preservar `assistant-panel.js` y evitar regresión BYOK multi-provider.
20. ✅ Trigger real aplicado para abrir bloque de empleabilidad + rigor enterprise.
21. ✅ Cierre GitFlow del bloque empleabilidad + rigor enterprise (4 repos + tracking final).
22. ✅ Ejecutar plan maestro de implementación de cursos (fases iOS -> Android -> SDD cerradas).
23. ✅ Integración final Hub cerrada (`build-hub strict`, `no drift`, `smoke`).
24. ⛔ Despliegue final Vercel bloqueado por cuota diaria (`api-deployments-free-per-day`).
25. ✅ Corrección visual Mermaid post-cierre integrada (fuentes iOS/Android + sync Hub).
26. ✅ Arquitectura por capas estilo mock migrada a SVG en iOS/Android/SDD y publicada en Hub.
27. ✅ Fase 1 performance móvil aplicada cross-course + sync Hub en verde.
28. ✅ Fase 2 mobile-first UX (Hub + cursos).
29. ✅ Fase 3 validación final + despliegue Vercel.
30. ✅ Desacoplar carga de Mermaid/Highlight del path crítico del arranque en iOS/Android/SDD.
31. ✅ Fase 8 de optimización de imágenes de arquitectura iOS para móvil (`webp` + fallback `png`).

## Siguiente paso concreto
1. Completar `0.3` del plan activo: limpieza documental de planes historicos cerrados en `docs/` y referencias.
2. Retomar `5.3` cuando reinicie cuota Vercel para ejecutar despliegue final.
3. Mantener commits atomicos y GitFlow estricto por bloque.
4. Actualizar handoff al cerrar cada ola real de auditoria.

## Riesgos abiertos
1. `codex resume` filtra por `cwd` si no se usa `--all`.
2. El índice de sesiones puede reflejar con desfase respecto al chat activo.
3. Riesgo de deriva de contexto si no se priorizan estos 4 documentos como fuente de verdad.

## Comandos útiles de continuidad
1. Ver todo en picker:
`codex resume --all`
2. Abrir hilo renombrado en raíz nueva:
`codex resume "UNIFY-WORKSPACE-STACK-ARCHITECTURE" --all -C "/Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture"`
3. Crear sesión nueva en esta raíz:
`cd "/Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture" && codex`
4. Validar drift de sync selectivo del Hub:
`cd "/Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture/stack-my-architecture-hub" && ./scripts/check-selective-sync-drift.sh`

## Hotfix activo 2026-03-02 — Sync cloud profile-scoped
1. ✅ Causa raíz cubierta: `updatedAt` cloud dejó de ser global por curso y pasa a ser específico por `profileKey`.
2. ✅ Priorización corregida: `progressProfile` en query fuerza perfil activo (sobrescribe storage local cuando aplica).
3. ✅ Build + sync hub en verde:
   - `./scripts/build-hub.sh --fast` -> PASS
   - `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`
   - `./scripts/smoke-hub-runtime.sh` -> OK
4. ✅ Trazabilidad versionada en:
   - `docs/HUB-STABILITY-LOG.md`
   - `docs/DECISIONS-ADR-LITE.md`

### Nota operativa para validación cross-device
Para ver el mismo progreso en otro dispositivo/navegador limpio, abrir el curso con el mismo `progressProfile` (enlace generado por `🔗 Copiar enlace de sincronización`).

## Hotfix incremental 2026-03-02 — sync-link con push cloud previo
1. ✅ `copySyncLink()` en iOS/Android/SDD fuerza `pushNow({ force: true })` antes de copiar enlace.
2. ✅ Validado en Playwright: se observa `POST /progress/state` `200` al pulsar `🔗 Copiar enlace de sincronización`.
3. ✅ Objetivo: evitar que iPhone abra perfil con estado remoto viejo cuando desktop tenía progreso solo local.

## Hotfix incremental 2026-03-02 (2) — `progressProfile` persistente en URL
1. ✅ `study-ux.js` en iOS/Android/SDD fuerza `?progressProfile=...` en la URL activa tras resolver perfil.
2. ✅ Objetivo: evitar que compartir/abrir enlace desde barra sin query pierda el perfil en iPhone/incógnito.
3. ✅ Validación:
   - `./scripts/build-hub.sh --fast` -> PASS.
   - `./scripts/smoke-hub-runtime.sh` -> OK.
   - Playwright local: URL sin query se normaliza a URL con `progressProfile` sin recarga.

## Bloque activo 2026-03-02 — Auth plataforma (registro/login + sync por cuenta)
1. ✅ Backend auth Hub implementado con TDD (`api/auth-sync.js` + `scripts/tests/test-auth-sync.js`).
2. ✅ Frontend auth Hub publicado (`/auth/index.html`, `/auth/register.html`, `/auth/login.html`).
3. ✅ Integracion progreso autenticado:
   - `api/progress-sync.js` ahora respeta `user.id` autenticado.
   - iOS/Android/SDD envian bearer en sync cuando existe sesion.
4. ✅ Validacion tecnica en verde:
   - test Node Hub (`16/16`),
   - `build-hub --mode strict`,
   - `check-selective-sync-drift` (`no drift 6/6`),
   - `smoke-hub-runtime`.
5. ✅ Cierre GitFlow completo (push + PR + merge en repos afectados) y deploy Vercel ejecutados.

### Nota de continuidad
La validación automática de login end-to-end queda parcialmente bloqueada si no se dispone de buzón para confirmar email (signup productivo exige confirmación). El backend/auth routes y la publicación están en verde.

## Bloque cerrado 2026-03-02 — Auth recovery (resend/recover)
1. ✅ Backend auth Hub soporta `route=resend` y `route=recover`.
2. ✅ API client expone `resendConfirmation()` y `recoverPassword()`.
3. ✅ `auth/recover.html` creado y enlazado desde login.
4. ✅ Rewrites Vercel para `/auth/resend` y `/auth/recover`.
5. ✅ Tests TDD para validación y mapeo de errores en `scripts/tests/test-auth-sync.js`.
6. ✅ Validación final y cierre:
   - `node --test scripts/tests/test-auth-sync.js` -> PASS (10/10).
   - `./scripts/build-hub.sh --mode strict` -> PASS.
   - `./scripts/smoke-hub-runtime.sh` -> OK.
7. ✅ PR merge en GitFlow y despliegue Vercel ejecutados.
   - PR `#71`.
   - `https://architecture-stack.vercel.app`
   - `https://architecture-stack-4zketscuo-merlosalbarracins-projects.vercel.app`
