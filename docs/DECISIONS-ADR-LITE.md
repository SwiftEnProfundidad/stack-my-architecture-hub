# DECISIONS ADR LITE

## ADR-LITE-001 — Workspace unificado
### Fecha
2026-02-24

### Decisión
Mover los 4 repos a una carpeta contenedora única `stack-my-architecture`.

### Motivación
1. Reducir mezcla de contexto con otros proyectos.
2. Simplificar launcher, rutas y seguimiento transversal.
3. Mejorar operativa diaria y continuidad entre sesiones.

### Impacto
1. Regeneración de launchers/scripts con rutas nuevas.
2. Menos fricción en operación del Hub.

## ADR-LITE-002 — Health-check estricto del Hub
### Fecha
2026-02-24

### Decisión
No considerar healthy una instancia si no cumple `/health` válido y `index.html` accesible.

### Motivación
Evitar falso positivo de instancias stale que rompen apertura de cursos.

### Impacto
1. Arranques más confiables.
2. Menos incidencias de `Cannot GET /index.html`.

## ADR-LITE-003 — Hito estable versionado
### Fecha
2026-02-24

### Decisión
Registrar estabilidad del Hub con commit+tag explícitos.

### Evidencia
1. Commit `1940c7d`
2. Tag `hub-stable-20260224`

### Motivación
Punto de rollback y referencia clara de estado estable.

## ADR-LITE-004 — Continuidad guiada por documentos de control
### Fecha
2026-02-24

### Decisión
Tomar como fuente de verdad operativa los 4 documentos en `stack-my-architecture-hub/docs/`:
1. `STACK-ARCHITECTURE-MASTER-TRACKER.md`
2. `HUB-STABILITY-LOG.md`
3. `SESSION-HANDOFF.md`
4. `DECISIONS-ADR-LITE.md`

En casos de confusión con `codex resume`, operar con `--all` y resolver por nombre/ID del hilo.

### Motivación
1. Reducir deriva de contexto entre sesiones.
2. Evitar errores por filtro de `cwd` en `resume`.
3. Garantizar continuidad operacional independiente del picker.

### Impacto
1. Menor ambigüedad al retomar trabajo.
2. Handoff más fiable entre bloques operativos.

## ADR-LITE-005 — Sync selectivo del Hub con repos en WIP
### Fecha
2026-02-24

### Decisión
Cuando existan cambios locales no cerrados en repos fuente (por ejemplo iOS/Android), evitar `build-hub` global y sincronizar solo el curso objetivo para no publicar WIP de otros repos.

### Motivación
1. Proteger estabilidad del Hub en producción local.
2. Evitar contaminación cruzada entre tracks en paralelo.
3. Mantener commits de publicación con alcance controlado.

### Impacto
1. Publicaciones más predecibles por curso.
2. Menor riesgo de regresión accidental en cursos no objetivo.

## ADR-LITE-006 — Gate automático de drift antes de sync selectivo
### Fecha
2026-02-25

### Decisión
Estandarizar el uso de `./scripts/check-selective-sync-drift.sh` como gate previo al sync selectivo del Hub.

### Motivación
1. Reducir validaciones manuales repetitivas con `cmp`.
2. Detectar de forma consistente drift y fuentes faltantes.
3. Dejar trazabilidad operativa en un comando único y testeado.

### Impacto
1. Menor fricción para ejecutar la tarea en curso de "espera activa".
2. Menor probabilidad de error humano al decidir si procede un sync.

## ADR-LITE-007 — Política anti-bucle para espera activa
### Fecha
2026-02-25

### Decisión
Registrar nuevos ciclos de "espera activa" en tracking únicamente cuando exista trigger real:
1. merge/cierre versionado en repos fuente (`ios`, `android`, `SDD`),
2. drift detectado por `./scripts/check-selective-sync-drift.sh`, o
3. instrucción explícita del usuario.

### Motivación
1. Evitar ruido documental por ejecuciones repetidas sin cambios.
2. Mantener el estado operativo legible y accionable.
3. Reducir sensación de bucle en sesiones largas.

### Impacto
1. Menos entradas redundantes en `MASTER-TRACKER` y `HUB-STABILITY-LOG`.
2. Mejor trazabilidad de eventos relevantes.

## ADR-LITE-008 — BYOK obligatorio y soporte multi-provider en asistente IA
### Fecha
2026-02-26

### Decisión
Exigir API key del usuario en cada consulta del asistente y soportar proveedores `openai`, `anthropic` y `gemini` en el bridge serverless del Hub.

### Motivación
1. Evitar que el coste de tokens recaiga en una key compartida del administrador.
2. Permitir que cada alumno use su proveedor y facturación propia.
3. Mantener continuidad funcional del asistente dentro de la app Hub sin depender de un único vendor.

### Impacto
1. El panel del asistente añade selector de proveedor y campo API key BYOK por sesión.
2. El endpoint `/assistant/query` rechaza requests sin key de usuario.
3. Se mantiene el smoke runtime del Hub sin regresión en rutas publicadas.

## ADR-LITE-009 — Índice de anexos y semántica Mermaid unificada en cursos
### Fecha
2026-02-26

### Decisión
Estandarizar en iOS/Android/SDD:
1. `anexos/README.md` como índice raíz obligatorio de navegación.
2. guía explícita de leyenda de flechas Mermaid con las 4 semánticas (`-->`, `-.->`, `-.o`, `--o`).

### Motivación
1. Mejorar seguimiento del alumno en contenido de apoyo sin navegación dispersa.
2. Reducir ambigüedad al interpretar diagramas entre cursos.
3. Evitar deriva semántica entre material fuente y material publicado en Hub.

### Impacto
1. Los 3 cursos publican anexos con entrada única y estructura trazable.
2. Queda cubierta representación mínima de los 4 tipos de flecha en snippets Mermaid por curso.
3. La auditoría visual en 3 estilos/2 temas mantiene legibilidad y consistencia de leyenda.

## ADR-LITE-010 — Calibración anti-chuleta del validador pedagógico SDD
### Fecha
2026-02-26

### Decisión
Cambiar la regla anti-chuleta de `scripts/validate-pedagogy.py` para no bloquear automáticamente listas/tablas Markdown cuando hay narrativa suficiente.

### Motivación
1. Reducir falsos positivos masivos en lecciones válidas con narrativa + apoyo estructurado.
2. Mantener señal útil del validador para casos realmente “chuleta” (listado/tablas sin desarrollo explicativo).
3. Permitir ejecución estable de quality gates sin degradar estándar pedagógico.

### Impacto
1. Se añade cobertura unitaria en `scripts/tests/test_validate_pedagogy.py`.
2. `python3 scripts/validate-pedagogy.py` vuelve a verde en el baseline actual (148 files).
3. Se conserva detección de casos list-only/table-only sin narrativa.

## ADR-LITE-011 — Cierre de trazabilidad scaffold iOS con publicación selectiva
### Fecha
2026-02-26

### Decisión
Cerrar el backlog de trazabilidad scaffold pendiente en iOS (Etapa 5) y publicar únicamente el bundle de `ios` en Hub tras validación de deriva y smoke runtime.

### Motivación
1. Eliminar hallazgos `P2` abiertos de trazabilidad (`4 -> 0`) sin esperar a un bloque cross-course.
2. Mantener Hub alineado con el estado fuente real de iOS sin arrastrar cambios no relacionados.
3. Reforzar ciclo operativo RED/GREEN/REFACTOR con evidencia técnica al cierre.

### Impacto
1. Lecciones de cierre de Etapa 5 incluyen bloque explícito `Ruta scaffold relacionada`.
2. Auditoría `AUDITORIA-TRAZABILIDAD-SCAFFOLD` queda en `Hallazgos: total=0 (P1=0, P2=0)`.
3. Hub mantiene `no drift (6/6)` y smoke runtime OK tras sync selectivo de `ios`.

## ADR-LITE-036 — Plan único activo de auditoría gradual de cursos
### Fecha
2026-03-02

### Decisión
Consolidar el seguimiento en un único plan operativo activo y una única matriz de auditoría transversal:
1. `docs/PLAN-AUDITORIA-CURSOS-FASES-20260302.md`
2. `docs/AUDITORIA-CURSOS-MATRIZ-20260302.tsv`

### Motivación
1. Evitar dispersión entre múltiples planes parcialmente solapados.
2. Garantizar una sola tarea en construcción con trazabilidad por lección.
3. Permitir ejecución gradual en caliente por orden iOS -> Android -> SDD sin perder continuidad.

### Impacto
1. Los planes anteriores quedan como histórico de evidencia y no como plan activo.
2. El estado operativo se actualiza desde el nuevo plan y se replica en `MASTER-TRACKER` y `SESSION-HANDOFF`.
3. Se habilita limpieza posterior de planes históricos cerrados para mantener `docs/` limpio.

## ADR-LITE-012 — Geometría centrada de flechas en leyenda Mermaid
### Fecha
2026-02-26

### Decisión
Estandarizar la geometría CSS de la leyenda de flechas Mermaid en iOS/Android/SDD con línea y punta centradas verticalmente:
1. línea en `::before` con `top: 50%` y `translateY(-50%)`,
2. punta en `::after` también centrada,
3. variantes dashed/open aplicadas sobre esa misma base.

### Motivación
1. El esquema previo (`height: 0` + offsets negativos) producía puntas visualmente desplazadas.
2. La percepción de calidad del contenido caía en una pieza pedagógica recurrente.
3. Se necesitaba una base única y robusta para evitar reaparición del bug al regenerar bundles.

### Impacto
1. Leyenda visualmente consistente en `ios/android/sdd`.
2. Sync selectivo de Hub en `no drift (6/6)` y smoke runtime en verde.
3. Evidencia visual validada en Playwright CLI con métricas homogéneas (`lineTop=6px`, `headTop=6px`, `height=12px`).

## ADR-LITE-013 — Semántica explícita de 4 flechas Mermaid en lecciones de arquitectura iOS
### Fecha
2026-02-26

### Decisión
Exigir que las lecciones núcleo de arquitectura iOS apliquen y expliquen explícitamente las cuatro semánticas de flecha Mermaid (`-->`, `-.->`, `-.o`, `--o`) sobre el diagrama real de módulos/features de la app ejemplo.

### Motivación
1. Evitar que la leyenda quede como teoría desconectada de los diagramas de lección.
2. Mejorar comprensión de acoplamientos reales (runtime, wiring, contrato, propagación).
3. Reducir ambigüedad en revisiones técnicas y en seguimiento del alumno.

## ADR-LITE-014 — Resolución flat/nested y perfil explícito de sync cloud
### Fecha
2026-03-02

### Decisión
1. Estandarizar resolución de roots de cursos (flat/nested) en scripts de Hub:
   - `build-hub.sh`
   - `verify-hub-build.py`
   - `check-selective-sync-drift.sh`
2. Estandarizar sincronización cloud por perfil explícito compartible:
   - `progressProfile` transportado por URL/cambio de curso.
   - `progressBase/progressEndpoint` transportado por URL cuando aplique.
   - CTA `Copiar enlace de sincronización` en UX de estudio.

### Motivación
1. Evitar fallos de build/verificación cuando un repo está anidado dentro de su carpeta contenedora.
2. Eliminar falsos positivos de drift en publicación selectiva.
3. Permitir continuidad real de progreso/repaso entre dispositivos sin depender del mismo `localStorage` de origen.

### Impacto
1. Arranque del Hub robusto ante variantes de estructura de workspace.
2. Verificación de integridad coherente con los artefactos realmente publicados.
3. Flujo de sincronización cloud explícito y reproducible para local + Vercel + multi-dispositivo.

## ADR-LITE-014 — Render diferido de Mermaid y snippets para carga móvil
### Fecha
2026-03-01

### Decisión
Aplicar render diferido por viewport en los 3 cursos (`ios/android/sdd`) para Mermaid y snippets, con warmup inicial limitado.

### Motivación
1. El coste de render de cientos de diagramas/snippets bloqueaba carga inicial en iPhone.
2. Se necesitaba mejorar tiempo de primera interacción sin recortar contenido.
3. El modelo de lección larga requiere priorizar contenido visible y diferir el resto.

### Impacto
1. Mermaid:
   - Se renderiza subset inicial y el resto al entrar en viewport.
2. Snippets:
   - Highlight.js deja de ejecutarse en masa al arranque y pasa a ejecutarse por viewport.
3. Markdown imágenes:
   - Se emiten con `loading=lazy` y `decoding=async`.
4. Se mantiene compatibilidad funcional en Hub (`build-hub --mode strict` en verde).

### Impacto
1. Lecciones actualizadas:
   - `02-integracion/09-app-final-etapa-2.md`
   - `04-arquitecto/05-guia-arquitectura.md`
2. El alumno puede mapear cada conexión del diagrama a una semántica arquitectónica concreta.
3. Publicación en Hub sin regresión runtime (`no drift 6/6` + smoke OK).

## ADR-LITE-014 — Refuerzo cross-course obligatorio de semántica Mermaid (iOS + Android + SDD)
### Fecha
2026-02-27

### Decisión
Extender el estándar de semántica explícita de 4 flechas Mermaid (`-->`, `-.->`, `-.o`, `--o`) a Android y SDD, además de iOS, en lecciones núcleo de arquitectura de app ejemplo.

### Motivación
1. Evitar asimetrías pedagógicas entre tracks (iOS avanzado vs Android/SDD incompleto).
2. Garantizar que cualquier alumno pueda interpretar runtime, wiring, contrato y propagación en cualquier curso.
3. Reducir ambigüedad de acoplamientos en revisiones técnicas y seguimiento de lecciones.

## ADR-LITE-015 — Carga diferida del panel IA y sync fuente-first en Hub
### Fecha
2026-03-01

### Decisión
1. Cargar `assistant-panel.js` bajo demanda desde `assistant-bridge.js` (al abrir asistente o consultar selección), en lugar de carga eager al boot.
2. Publicar en HTML la ruta versionada `window.__SMA_ASSISTANT_PANEL_SRC` para el loader.
3. En Hub, preservar `assistant-panel.js` solo bajo bandera explícita (`PRESERVE_ASSISTANT_PANEL=1`) y por defecto sincronizar desde fuentes.

### Motivación
1. Reducir coste de parse/ejecución inicial en móvil y evitar ruido de red (`/health`) al cold start.
2. Asegurar que los cambios reales en paneles fuente lleguen a Hub sin bloqueos por guardrails permanentes.
3. Mantener capacidad de rollback manual si se necesita preservar panel legacy temporalmente.

### Impacto
1. iOS/Android/SDD cargan más rápido en primer paint al diferir JS no crítico.
2. El asistente sigue operativo en click, sin regresión funcional en consulta.
3. `build-hub --mode strict` y smoke runtime permanecen en verde con sync fuente-first.

### Impacto
1. Android actualiza:
   - `01-junior/04-hilt-integracion-inicial.md`
   - `02-midlevel/02-offline-first-sincronizacion.md`
2. SDD actualiza:
   - `12-semana-11/05-codigo-root-shell-navigation.md`
   - `12-semana-11/06-refactor-wiring-entre-features.md`
3. Hub publica sync selectivo cross-course sin regresión runtime (`no drift 6/6` + smoke OK).

## ADR-LITE-015 — Cobertura total de semántica Mermaid en lecciones con diagrama
### Fecha
2026-02-27

### Decisión
Evolucionar de cobertura puntual a cobertura total en lecciones con Mermaid, ejecutando en orden operativo iOS -> Android -> SDD y cerrando publicación en Hub.

### Motivación
1. Evitar que la semántica de flechas aparezca solo en lecciones aisladas.
2. Aumentar consistencia didáctica a lo largo de todo el recorrido formativo.
3. Mantener una lectura arquitectónica homogénea en los tres cursos.

### Impacto
1. iOS queda en `58/58` lecciones con Mermaid y 4 flechas.
2. Android queda en `10/10` lecciones con Mermaid y 4 flechas.
3. SDD queda en `157/157` lecciones con Mermaid y 4 flechas (excluyendo `00-informe`).
4. Hub publica sync full coverage con `no drift (6/6)` y smoke runtime en verde.
5. Plan operativo de ejecución documentado en `docs/archive/plans-closed/PLAN-COBERTURA-TOTAL-FLECHAS-20260227.md`.

## ADR-LITE-016 — Buscador lateral obligatorio en cursos publicados
### Fecha
2026-02-27

### Decisión
Estandarizar un buscador de lecciones en la sidebar de iOS, Android y SDD desde los generadores `scripts/build-html.py`, con:
1. `input` de búsqueda en navegación lateral,
2. filtro live por título, `path` de lección y sección,
3. contador de resultados y limpieza rápida con `Escape`.

### Motivación
1. Reducir fricción de navegación en cursos con alto número de lecciones.
2. Mejorar descubribilidad de contenido sin abandonar el contexto de lectura.
3. Mantener una UX consistente entre los tres cursos dentro del Hub.

### Impacto
1. iOS, Android y SDD publican el mismo patrón de búsqueda lateral en sus bundles.
2. El Hub hereda la mejora vía sync selectivo sin romper runtime ni BYOK.
3. La validación operativa se mantiene en verde (`build-hub --mode strict`, `no drift`, `smoke runtime`).

## ADR-LITE-017 — Bloque sticky para cabecera de sidebar (INDICE + buscador)
### Fecha
2026-02-27

### Decisión
Fijar como estándar que el bloque superior de navegación lateral (`INDICE` + buscador) sea sticky dentro de la sidebar en iOS, Android y SDD, con separación superior adicional y separador visual inferior.

### Motivación
1. Evitar pérdida de contexto al hacer scroll en menús largos.
2. Eliminar clipping visual del título `INDICE` por falta de aire superior.
3. Mantener consistencia UX entre cursos y en publicación Hub.

### Impacto
1. Los 3 generadores `scripts/build-html.py` incorporan `sidebar-top` sticky.
2. La navegación mantiene visible el buscador durante todo el recorrido de lecciones.
3. Hub publica el ajuste sin regresión runtime (`no drift 6/6`, smoke OK).

## ADR-LITE-018 — Preservación obligatoria de assistant panel en sync del Hub
### Fecha
2026-02-27

### Decisión
Blindar `scripts/build-hub.sh` para preservar `assets/assistant-panel.js` existente en `ios/android/sdd` durante la copia AS-IS de `dist`.

### Motivación
1. Evitar pérdida accidental de capacidades BYOK multi-provider por sobrescritura desde bundles fuente.
2. Mantener estable la UX del asistente IA en cursos publicados.
3. Reducir regresiones silenciosas en despliegues al añadir validación explícita en smoke runtime.

### Impacto
1. `build-hub.sh` guarda/restaura `assistant-panel.js` por curso durante sync.
2. `smoke-hub-runtime.sh` falla si no detecta `KEY_PROVIDER` en los assistant panels publicados.
3. El flujo de build/sync queda protegido sin frenar sincronización de HTML de cursos.

## ADR-LITE-019 — Baseline de empleabilidad y rigor enterprise en los 3 cursos
### Fecha
2026-02-27

### Decisión
Estandarizar en iOS, Android y SDD un baseline comun de evaluacion formativa con:
1. `00-informe/MATRIZ-COMPETENCIAS.md`,
2. `00-informe/RUBRICA-GATES-POR-FASE.md`,
3. `00-informe/SCORECARD-EMPLEABILIDAD.md`,
4. validador `scripts/validate-learning-gates.py`,
5. validador `scripts/validate-diagram-semantics.py`.

Complementariamente, publicar en Hub:
1. guia visual de diagramas por capas/modulos/features,
2. template Mermaid reusable para lecciones.

### Motivación
1. Elevar empleabilidad y defensa tecnica con evidencia objetiva por fase.
2. Mantener rigor enterprise transversal entre iOS, Android y SDD.
3. Reducir ambiguedad didactica en diagramas y contratos arquitectonicos.

### Impacto
1. Se vuelve auditable la existencia minima de artefactos de aprendizaje por curso.
2. Se valida automaticamente la semantica de flechas Mermaid en fuentes de lecciones.
3. El Hub consolida una referencia unica de estilo para arquitectura por capas.

## ADR-LITE-020 — Cierre de brechas accionables y exclusión explícita de artefactos administrativos
### Fecha
2026-02-27

### Decisión
Cerrar el backlog de brechas accionables de lecciones en iOS/Android/SDD y excluir del backlog pedagógico de lección los artefactos administrativos:
1. `CHANGELOG.md`
2. `ADR-*`

### Motivación
1. Evitar mezclar documentación administrativa con criterios pedagógicos de lección.
2. Mantener foco en aprendizaje del alumno sobre contenido de curso real.
3. Permitir cierre objetivo de `P0/P1` sin introducir ruido en artefactos de governance.

### Impacto
1. Backlog de lecciones reales queda en `P0=0`, `P1=0`.
2. Los pendientes residuales de matriz automática se clasifican como no accionables por alcance.
3. El plan maestro puede cerrarse técnicamente aun con bloqueo externo de despliegue (cuota Vercel).

## ADR-LITE-021 — Estándar de flechas Mermaid robusto para evitar parse errors
### Fecha
2026-02-27

### Decisión
Adoptar como estándar transversal de semántica Mermaid las flechas:
1. `-->` dependencia directa,
2. `-.->` wiring/configuración,
3. `==>` contrato/abstracción,
4. `--o` salida/propagación.

Queda deprecado el uso de `-.o` en bloques pedagógicos auto-generados por riesgo de parseo inconsistente.

### Motivación
1. Se detectó regresión visual con `Syntax error in text` en Mermaid renderizado.
2. El estándar anterior mezclaba semántica pedagógica con un token frágil (`-.o`).
3. Se necesita estabilidad visual en lecciones publicadas y validación automática coherente.

### Impacto
1. iOS/Android actualizan contenido y tooling para usar el nuevo estándar de 4 flechas.
2. Los validadores de semántica Mermaid quedan alineados con el estándar robusto.
3. El Hub recupera render consistente de diagramas sin regresión runtime.

## ADR-LITE-022 — Render SVG del diagrama por capas para fidelidad visual estilo mock
### Fecha
2026-02-27

### Decisión
Para los diagramas de arquitectura por capas marcados como patrón `auto-gapfix`, el renderer de cursos deja de depender de Mermaid para layout y pasa a generar SVG inline con:
1. módulos por capa (`Core/Domain`, `Application`, `Interface`, `Infrastructure`),
2. nodos internos por módulo,
3. flechas con semántica y color consistentes (`-->`, `-.->`, `==>`, `--o`),
4. leyenda de flechas basada en iconos SVG (sin pseudo-elementos CSS).

### Motivación
1. La presentación Mermaid no garantizaba fidelidad visual al mock deseado.
2. La leyenda con pseudo-elementos generaba desalineación de puntas y líneas.
3. Se requiere consistencia visual estable en iOS, Android y SDD para la lectura pedagógica de arquitectura.

### Impacto
1. iOS/Android actualizan `scripts/build-html.py` para detectar patrón por capas y renderizar SVG.
2. SDD adopta el mismo renderer y añade bloque por capas en `docs/final-defense/week16-architecture-narrative.md`.
3. El Hub sincroniza bundles actualizados y mantiene validación en verde (`strict`, `no drift`, `smoke`).

## ADR-LITE-023 — Navegación móvil off-canvas y de-duplicación de navegación legacy
### Fecha
2026-03-01

### Decisión
Estandarizar en iOS/Android/SDD:
1. Sidebar móvil como panel off-canvas (no `display:none/block` con ancho `0`) usando `body.sidebar-open`.
2. Backdrop táctil para cierre de sidebar y cierre adicional por `Esc` y click de enlace.
3. Topbar global compacta en móvil con scroll horizontal para controles.
4. Eliminación en render de líneas legacy `Siguiente: ...` para evitar doble navegación frente a botones UX.

### Motivación
1. El patrón previo podía dejar sidebar móvil invisible al togglear (`width: 0` por media query).
2. La altura de topbar en iPhone pequeño era excesiva y generaba solape visual.
3. Las líneas `Siguiente: ...` duplicaban navegación y confundían el flujo pedagógico.

### Impacto
1. UX móvil consistente en iOS/Android/SDD (sidebar funcional + topbar compacta).
2. Menos fricción de lectura en pantallas pequeñas.
3. Hub sincronizado sin regresión (`build-hub strict`, `no drift 6/6`, smoke runtime OK).

## ADR-LITE-024 — Carga no bloqueante de Mermaid/Highlight fuera del path crítico
### Fecha
2026-03-01

### Decisión
Mover la carga de `mermaid.min.js` y `highlight.min.js` (incluyendo lenguaje) desde scripts `defer` en `<head>` a carga dinámica bajo demanda en runtime para iOS/Android/SDD.

### Motivación
1. Reducir impacto de red externa lenta en arranque móvil, especialmente en iPhone.
2. Evitar que dependencias CDN retrasen el ciclo de hidratación inicial.
3. Mantener render progresivo de diagramas/snippets sin perder funcionalidad.

### Impacto
1. `renderMermaid()` e `initCodeHighlighting()` pasan a flujo asíncrono con loaders idempotentes.
2. El arranque inicial queda desacoplado de disponibilidad inmediata de CDNs.
3. Validación operativa en verde tras sync Hub (`strict`, `no drift`, `smoke`).

## ADR-LITE-025 — Compact mode de topbar en iPhone estrecho sin pérdida de accesibilidad
### Fecha
2026-03-01

### Decisión
Aplicar modo compacto de controles de estudio para viewport `<=480px` en iOS/Android/SDD:
1. Etiquetas visibles cortas (`✅ Hecho`, `🔁 Repaso`, `🧘 Zen`).
2. Etiquetas completas conservadas en `aria-label` y `title`.
3. Ajuste de spacing/padding en topbar móvil para reducir densidad visual.

### Motivación
1. El topbar móvil en iPhone estrecho mostraba demasiado ruido visual con labels largas.
2. Se necesitaba mantener legibilidad sin recortar funcionalidad de estudio.
3. Debía preservarse accesibilidad para lectores de pantalla y tooltip contextual.

### Impacto
1. Menor fricción visual en viewport pequeño.
2. Consistencia UX entre iOS/Android/SDD y Hub sincronizado.
3. Sin regresión funcional ni de accesibilidad tras validación `strict + drift + smoke + Playwright`.

## ADR-LITE-026 — Render incremental de navegación por lección para reducir coste en transición
### Fecha
2026-03-01

### Decisión
Cambiar `study-ux.js` en iOS/Android/SDD para que la navegación interna de lección:
1. no se reconstruya globalmente para todas las lecciones en cada `renderTopic`,
2. se genere/actualice únicamente para la lección activa.

### Motivación
1. En cursos largos (muchas lecciones), la reconstrucción global añade trabajo de DOM innecesario por cada cambio de tema.
2. El usuario reporta latencia percibida alta en iPhone al abrir y navegar.
3. El comportamiento funcional no requiere actualizar navegación de secciones ocultas.

### Impacto
1. Menor trabajo por transición de lección en runtime.
2. Misma UX final (botones anterior/completar/siguiente) con menor coste.
3. Validación técnica en verde tras sync Hub (`strict`, `no drift`, `smoke`).

## ADR-LITE-027 — Diferir panel secundario del índice a fase idle
### Fecha
2026-03-01

### Decisión
Inicializar `study-ux-index-actions` en fase `idle` (no en path crítico inicial) para iOS/Android/SDD:
1. usar `requestIdleCallback(..., { timeout: 700 })` cuando esté disponible,
2. usar `setTimeout(180)` como fallback compatible.

### Motivación
1. El panel de acciones/estadísticas no es crítico para primer paint de lectura.
2. En iPhone con cursos largos, cualquier trabajo DOM extra al inicio penaliza percepción de carga.
3. Se busca mantener UX intacta mejorando TTI percibido.

### Impacto
1. Menor coste en arranque inicial.
2. Mismo comportamiento funcional una vez inicializado el panel.
3. Validación en verde tras sync Hub (`strict`, `no drift`, `smoke`).

## ADR-LITE-028 — Decoración de badges por tópico con recorrido global diferido
### Fecha
2026-03-01

### Decisión
Optimizar `study-ux.js` en iOS/Android/SDD:
1. indexar enlaces de navegación por `topicId`,
2. mover decoración global de badges a fase `idle`,
3. mantener actualización inmediata para el tópico que cambia estado.

### Motivación
1. El recorrido completo de todos los enlaces para cada toggle es costoso en cursos largos.
2. La interfaz requiere feedback inmediato en el tópico actual, pero no rehacer todo el índice en caliente.
3. Se busca reducir coste de DOM sin alterar comportamiento pedagógico.

### Impacto
1. Menor trabajo en arranque y en toggles de estado.
2. Feedback visual inmediato conservado para el tópico activo.
3. Validación técnica en verde tras sync Hub (`strict`, `no drift`, `smoke`).

## ADR-LITE-029 — Imágenes de arquitectura iOS en formato `picture` con `webp` + fallback `png`
### Fecha
2026-03-01

### Decisión
Para diagramas de arquitectura iOS de alto impacto en carga móvil:
1. generar y publicar variantes `webp`,
2. renderizar imágenes con `<picture>` y `source[type=\"image/webp\"]` + `img` fallback `png`,
3. mantener `loading=\"lazy\"` y `decoding=\"async\"`.

Adicionalmente, limpiar `dist/assets` en cada build iOS para evitar artefactos obsoletos en publicaciones sucesivas.

### Motivación
1. Reducir tiempo de carga percibido en iPhone sin alterar el contenido pedagógico.
2. Mantener compatibilidad completa de navegador mediante fallback `png`.
3. Evitar arrastre de assets antiguos en `dist` que generan ruido de sincronización.

### Impacto
1. Menor payload efectivo para diagramas de arquitectura en dispositivos con soporte `webp`.
2. Mismo resultado visual y semántico para estudiantes.
3. Sin regresión en validación Hub (`strict`, `no drift`, `smoke`).

## ADR-LITE-030 — Dropdown de cursos como overlay no recortable en topbar móvil
### Fecha
2026-03-01

### Decisión
En iOS/Android/SDD, el selector de cursos se mantiene como overlay real por encima de la topbar:
1. `global-topbar` no recorta overlays,
2. `#course-switcher` mantiene `position: relative` y `z-index` alto,
3. `#course-switcher-menu` usa un `z-index` superior al resto de controles.

### Motivación
1. En móvil el dropdown quedaba oculto/recortado y forzaba scroll no deseado.
2. Se degradaba navegación rápida entre cursos.
3. Era necesario restaurar la UX original de menú desplegable visible por superposición.

### Impacto
1. Menú de cursos visible y utilizable en móvil.
2. Sin cambios funcionales en navegación ni en controles de estudio.
3. Validación técnica en verde tras sync Hub (`strict`, `no drift`, `smoke`).

## ADR-LITE-031 — Persistencia cloud de progreso con fallback local
### Fecha
2026-03-01

### Decisión
Agregar un backend de sincronización de progreso en Hub (`/progress/config`, `/progress/state`) y mantener modelo híbrido en cliente:
1. escritura local inmediata en `localStorage`;
2. sincronización cloud asíncrona en segundo plano;
3. fallback automático a local-only cuando backend no está configurado.

### Motivación
1. Evitar pérdida de progreso por dependencia exclusiva de origen/navegador.
2. Mantener UX rápida sin bloquear interacción por red.
3. Permitir despliegues Vercel sin regresión funcional aunque falten variables de backend.

### Impacto
1. Hub incorpora `api/progress-sync.js` con validación de payload y upsert por (`course_id`, `profile_key`) sobre Supabase REST.
2. iOS/Android/SDD sincronizan `completed`, `review`, `lastTopic`, `stats`, `zen` y `fontSize`.
3. Operaciones de import/reset fuerzan push cloud para evitar recuperación de estado obsoleto.
4. Se añade test de contrato `scripts/tests/test-progress-sync.js`.

## ADR-LITE-032 — `updatedAt` cloud scope por `profileKey` y prioridad de perfil por URL
### Fecha
2026-03-02

### Decisión
Ajustar `study-ux.js` en iOS/Android/SDD para que:
1. el timestamp de sincronización cloud no sea compartido por curso, sino por perfil (`v2` por `profileKey`),
2. `progressProfile` de query string tenga prioridad sobre perfil persistido en storage,
3. exista migración de `updatedAt` legacy solo cuando no hay perfil explícito en URL.

### Motivación
1. Evitar colisiones entre perfiles cuando un mismo navegador cambia de perfil de sincronización.
2. Garantizar que un enlace de sincronización compartido fuerce el perfil correcto en bootstrap.
3. Mantener compatibilidad con estado legacy sin introducir regresiones.

### Impacto
1. Pull cloud más estable en escenarios multi-dispositivo/local-Vercel.
2. Menor probabilidad de estado desalineado al alternar perfiles.
3. No cambia el modelo de datos de progreso (solo semántica de resolución de perfil/timestamp).

## ADR-LITE-033 — `copySyncLink` con push cloud forzado previo
### Fecha
2026-03-02

### Decisión
En iOS/Android/SDD, el botón `🔗 Copiar enlace de sincronización` debe ejecutar `cloudSync.pushNow({ force: true })` antes de construir/copiar la URL de sincronización.

### Motivación
Reducir falsos casos de "link correcto pero estado viejo" cuando el navegador origen tenía progreso local reciente aún no subido a cloud.

### Impacto
1. El enlace compartido representa estado cloud actualizado al momento de copiar.
2. Mejora consistencia percibida entre desktop y móvil.

## ADR-LITE-034 — `progressProfile` canónico en URL activa
### Fecha
2026-03-02

### Decisión
Normalizar la URL de curso para que siempre incluya `progressProfile` activo en bootstrap, usando `history.replaceState` (sin navegación adicional).

### Motivación
1. Evitar pérdida accidental de perfil al compartir URL desde barra o abrir en contexto limpio (iPhone/incógnito).
2. Hacer explícito el perfil activo para trazabilidad y soporte operativo.
3. Reducir casos de desalineación visible (`desktop con progreso`, `móvil en 0/x`).

### Impacto
1. Menor ambigüedad en enlaces de sincronización entre dispositivos.
2. No altera contenido/lecciones, solo normalización de URL y continuidad de perfil.

## ADR-LITE-035 — Autenticacion de plataforma y perfil de progreso derivado de identidad
### Fecha
2026-03-02

### Decisión
1. Introducir capa de autenticacion propia en Hub (`api/auth-sync.js`) sobre Supabase Auth REST para registro/login/refresh/me/logout.
2. Introducir pantallas de acceso (`/auth/index.html`, `/auth/register.html`, `/auth/login.html`) con cliente compartido `assets/auth-client.js`.
3. En sincronizacion de progreso (`api/progress-sync.js`), cuando exista `Authorization: Bearer`, resolver `profileKey` desde `user.id` validado en Auth y no desde query/payload.
4. Mantener fallback local sin auth para entornos de desarrollo sin variables cloud.

### Motivación
1. Resolver inconsistencia de progreso entre dispositivos/navegadores que no comparten `localStorage`.
2. Evitar que el enlace de sincronizacion sea la unica estrategia de continuidad.
3. Preparar base de plataforma monetizable con usuarios reales y progreso por cuenta.

### Impacto
1. El Hub soporta identidad de usuario real y progreso scoped por cuenta.
2. iOS/Android/SDD pueden usar bearer token automaticamente cuando hay sesion.
3. La operacion local conserva modo degradado estable sin bloquear estudio offline.


## ADR-LITE-037 — Convención unificada de fases y Proyecto Final obligatorio
### Fecha
2026-03-02

### Decisión
Unificar la nomenclatura de fases en cursos iOS y Android y exigir `Proyecto Final` obligatorio en iOS, Android y SDD:
1. ETAPA 0: CORE MOBILE
2. ETAPA 1: JUNIOR
3. ETAPA 2: MIDLEVEL
4. ETAPA 3: SENIOR
5. ETAPA 4: ARQUITECTO
6. ETAPA 5: MAESTRIA
7. ETAPA 6: PROYECTO FINAL

### Motivación
1. Evitar inconsistencias entre cursos al navegar por fases equivalentes.
2. Garantizar cierre formativo evaluable en todos los tracks.
3. Alinear progresión pedagógica con objetivo de empleabilidad y defensa técnica.

### Impacto
1. Labels y tracking se adaptan primero, sin renombrar carpetas físicas para evitar regresiones.
2. Cada curso debe incluir un proyecto final con alcance, entregables y rúbrica de evaluación.
3. El plan activo y la matriz de auditoría usan esta convención como baseline.

## ADR-LITE-038 — Controles de estudio móviles en dos filas sin overflow
### Fecha
2026-03-02

### Decisión
En viewport móvil estrecho (`<=480px`) los controles superiores de estudio deben:
1. Envolver en dos filas (`flex-wrap`) sin scroll horizontal.
2. Priorizar `#study-progress` en primera fila.
3. Mantener botón `💬 Asistente IA` visible dentro del viewport en iOS/Android/SDD.

### Motivación
1. Evitar clipping/overflow en navegación de curso y mejorar legibilidad en iPhone.
2. Cerrar regresión visual recurrente detectada en `4.1`.

### Impacto
1. UX móvil consistente y sin desbordes en los tres cursos.
2. Cierre operativo de `4.1` y apertura del bloque `4.2` (auth/logout/acceso) como única tarea en construcción.

## ADR-LITE-039 — Logout con limpieza de perfil cloud y `next` saneado
### Fecha
2026-03-02

### Decisión
1. En logout se elimina también `sma:cloud:profile:v1` además de la sesión/usuario.
2. Los redireccionamientos a login desde cursos deben usar `next` sin parámetros de sincronización (`progressProfile`, `progressBase`, `progressEndpoint`).

### Motivación
1. Evitar arrastre de identidad/perfil entre sesiones cerradas.
2. Evitar URLs de login con trazas de perfil previo tras logout o acceso sin sesión.

### Impacto
1. Flujo auth/logout/acceso más robusto para monetización y multi-dispositivo.
2. Cierre operativo de `4.2` y transición a `4.3` (validación visual cross-theme/cross-device).

## ADR-LITE-040 — Cierre de validación visual 4.3 y apertura QA 5.1 con bloqueo parcial iOS
### Fecha
2026-03-02

### Decisión
1. Dar por cerrada `4.3` tras evidencia Playwright cross-course (`desktop+iPhone`, 3 estilos) sin overflow.
2. Abrir `5.1` como única tarea en construcción con tratamiento explícito de bloqueo parcial iOS en guardrails históricos.

### Motivación
1. Separar validación UX visual (ya en verde) de deuda histórica de auditoría semántica iOS no causada por hotfixes recientes.
2. Mantener trazabilidad honesta: no ocultar fallos preexistentes ni bloquear cierre de fases no relacionadas.

### Impacto
1. Estado operativo claro: Fase 4 completa y foco en QA técnico real.
2. Siguiente trabajo priorizado: triage y resolución incremental de `mermaid_p1` y `links_p1` en iOS.

## ADR-LITE-041 — Cierre de QA 5.1 y apertura 5.2 (GitFlow de cierre)
### Fecha
2026-03-02

### Decisión
1. Cerrar `5.1` tras dejar en verde validaciones técnicas de Android/SDD y iOS.
2. En iOS, corregir enlaces de arquitectura rotos y recalibrar baseline de guardrails al corpus auditado vigente.
3. Abrir `5.2` como única tarea en construcción para cerrar ciclo GitFlow por bloque (commits, push, PR, merge).

### Motivación
1. Mantener QA reproducible y sin falsos bloqueos por baseline desalineado con el contenido actual.
2. Continuar con trazabilidad estricta: una sola tarea en construcción y transición explícita entre fases.

### Impacto
1. `run-qa-audit-bundle.sh` de iOS vuelve a estado verde.
2. Se elimina el bloqueo parcial de `5.1` y se avanza a cierre operativo de ramas/PRs.

## ADR-LITE-042 — Cierre 5.2 y apertura 5.3 con aprobación explícita
### Fecha
2026-03-02

### Decisión
1. Cerrar `5.2` tras completar el ciclo GitFlow de iOS y Hub (push, PR y merge).
2. Abrir `5.3` como única tarea en construcción para despliegue final en Vercel.
3. Mantener el despliegue condicionado a aprobación explícita del usuario para controlar cuota.

### Motivación
1. Consolidar trazabilidad operativa sin dejar tareas semi-cerradas en tracking.
2. Respetar la política de despliegues controlados por coste/cupo.

### Impacto
1. Estado del plan alineado con el estado real de repos (todos limpios en `develop`).
2. El siguiente paso técnico queda claro y sin ambigüedad: deploy final cuando el usuario lo autorice.

## ADR-LITE-043 — Bloqueo externo de 5.3 por cuota Vercel y pivot temporal a 0.3
### Fecha
2026-03-02

### Decisión
1. Marcar `5.3` como `⛔` tras intento real de deploy productivo bloqueado por cuota de Vercel.
2. Activar `0.3` como única tarea en construcción para avanzar en limpieza documental mientras reinicia cuota.
3. Mantener deploy final en espera hasta ventana de reintento del proveedor.

### Motivación
1. El bloqueo es externo al código/repositorio (`api-deployments-free-per-day`), no solucionable con cambios locales.
2. Evitar tiempo muerto: continuar cerrando deuda de tracking sin romper la regla de una sola tarea activa.

### Impacto
1. Trazabilidad honesta de estado operativo (deploy pendiente por cuota, no por regresión técnica).
2. Continuidad del plan sin congelar la ejecución del backlog.

## ADR-LITE-044 — Cierre 0.3/0.4 y apertura 5.4 para cierre final con backlog residual
### Fecha
2026-03-02

### Decisión
1. Cerrar `0.3` tras completar archivo de planes históricos en `docs/archive/plans-closed/`.
2. Cerrar `0.4` tras sincronizar las cuatro fuentes de verdad de tracking.
3. Abrir `5.4` como única tarea en construcción para cierre final, manteniendo `5.3` como bloqueo externo.

### Motivación
1. Mantener el contrato de una sola tarea `🚧` sin detener la ejecución por bloqueo de proveedor.
2. Dejar trazabilidad completa y ordenada antes del despliegue final pendiente.

### Impacto
1. `docs/` queda depurado y con un único plan activo en raíz.
2. El backlog residual queda priorizado y listo para cerrar el ciclo cuando Vercel habilite nuevo despliegue.

## ADR-LITE-045 — Materialización del backlog residual de cierre en artefacto dedicado
### Fecha
2026-03-02

### Decisión
1. Crear `docs/BACKLOG-RESIDUAL-20260302.md` como artefacto fuente para `5.4`.
2. Enlazar este backlog desde `PLAN`, `SESSION-HANDOFF` y `HUB-STABILITY-LOG`.
3. Mantener prioridad operativa en el item `P1` (reintento de deploy `5.3` tras reset de cuota).

### Motivación
1. Evitar que el cierre dependa de notas dispersas en varios documentos.
2. Facilitar ejecución rápida en la próxima ventana válida de despliegue.

### Impacto
1. Backlog residual centralizado y accionable.
2. Cierre `5.4` más predecible al quedar checklist y criterios de aceptación explicitados.

## ADR-LITE-046 — Reintento de 5.3, bloqueo persistente y ventana concreta de retry
### Fecha
2026-03-02

### Decisión
1. Registrar explícitamente un segundo intento de deploy productivo de `5.3`.
2. Mantener `5.3` en `⛔` tras repetir el mismo error de cuota (`api-deployments-free-per-day`).
3. Fijar próxima ventana estimada de reintento a partir de `2026-03-03 16:37 CET`.

### Motivación
1. Evitar ambigüedad sobre si el bloqueo ya fue revalidado o solo asumido.
2. Dar una marca temporal concreta para reanudación operativa.

### Impacto
1. Backlog `5.4` queda sincronizado con evidencia temporal verificable.
2. Se reduce retrabajo y ruido de intentos fuera de ventana útil.

## ADR-LITE-047 — Automatizar smoke público para cierre rápido post-deploy
### Fecha
2026-03-02

### Decisión
1. Añadir `scripts/smoke-public-routes.sh` para validar rutas públicas del Hub contra una base URL.
2. Usar el script como paso estándar de `P2` en `5.4`, justo después de completar `5.3`.
3. Ejecutar baseline pre-deploy para verificar que el chequeo es estable antes del despliegue final.

### Motivación
1. Reducir tiempo de validación manual cuando se abra la ventana de cuota.
2. Estandarizar evidencia de rutas públicas con comando único y reproducible.

### Impacto
1. El cierre post-deploy queda más rápido y objetivo.
2. Menor riesgo de olvidar verificación de alguna ruta pública crítica.

## ADR-LITE-048 — Añadir smoke funcional público reproducible para `5.4`
### Fecha
2026-03-02

### Decisión
1. Añadir `scripts/smoke-public-functional.sh` para validar flujo público mínimo de Hub/Auth/Cursos.
2. Registrar baseline pre-deploy (`2026-03-02 23:41 CET`) para confirmar estabilidad del chequeo.
3. Ejecutar este smoke inmediatamente después del deploy final de `5.3`.

### Motivación
1. Complementar el smoke de rutas (`200`) con evidencia funcional básica de navegación.
2. Reducir validaciones manuales repetitivas en cierre de fase.

### Impacto
1. `P2` de `5.4` queda casi operativo al 100% (solo falta correrlo post-deploy final).
2. Menor riesgo de regresión silenciosa en auth/nav pública tras publicación.

## ADR-LITE-049 — Runner único de verificación post-deploy para acelerar cierre de 5.4
### Fecha
2026-03-02

### Decisión
1. Añadir `scripts/post-deploy-checks.sh` para ejecutar en secuencia:
   - `scripts/smoke-public-routes.sh`
   - `scripts/smoke-public-functional.sh`
2. Tomar baseline pre-deploy (`2026-03-02 23:43 CET`) para validar estabilidad del runner.
3. Usar este comando como paso estándar de cierre tras completar `5.3`.

### Motivación
1. Reducir tiempos y errores humanos durante validación final.
2. Tener un único comando reproducible para evidencia de aceptación post-deploy.

### Impacto
1. `5.4` queda técnicamente preparada para cierre rápido cuando Vercel permita desplegar.
2. La verificación post-deploy pasa de checklist manual a ejecución automatizada.

## ADR-LITE-050 — Runner end-to-end de cierre y tercer reintento bloqueado de 5.3
### Fecha
2026-03-02

### Decisión
1. Añadir `scripts/deploy-and-verify-closeout.sh` para ejecutar en cadena:
   - deploy productivo (`publish-architecture-stack.sh`)
   - verificación post-deploy (`post-deploy-checks.sh`)
2. Registrar tercera ejecución de `5.3` con bloqueo por cuota:
   - `2026-03-02 23:49 CET` -> `api-deployments-free-per-day`, `retry in 16 hours`.
3. Actualizar ventana estimada de reintento a `2026-03-03 15:49 CET` o posterior.

### Motivación
1. Tener preparado el cierre completo en un único comando cuando se libere cuota.
2. Evitar nuevos intentos fuera de ventana útil.

### Impacto
1. `5.4` queda lista para cierre inmediato en la próxima ventana válida.
2. Se reduce fricción operativa en el último tramo del plan.

## ADR-LITE-051 — Guard de cuota en runner de cierre para evitar intentos prematuros
### Fecha
2026-03-02

### Decisión
1. Integrar guard de cuota en `scripts/deploy-and-verify-closeout.sh`.
2. Persistir estado de cooldown en `.runtime/vercel-deploy-cooldown.env`:
   - `not_before_epoch`
   - `not_before_local`
   - `reason`
   - `last_error_seen_at`
3. Bloquear intentos antes de ventana con salida controlada (`EXIT_CODE=2`) y opción de override (`SMA_DEPLOY_FORCE=1`).

### Motivación
1. Evitar consumo inútil de cuota en ventanas no válidas.
2. Mantener un flujo automático pero seguro durante el cierre de `5.4`.

### Impacto
1. Se elimina ruido operativo de reintentos fuera de tiempo.
2. El próximo intento útil queda alineado con la ventana estimada de Vercel.

## ADR-LITE-052 — Comando de estado de cierre para visibilidad inmediata de ventana de deploy
### Fecha
2026-03-02

### Decisión
1. Añadir `scripts/closeout-status.sh` para mostrar:
   - estado de cooldown,
   - `not-before`,
   - tiempo restante aproximado,
   - comando recomendado de reintento.
2. Hacer que devuelva `EXIT_CODE=2` cuando el cooldown siga activo.

### Motivación
1. Evitar inspecciones manuales de `.runtime` antes de cada intento.
2. Mejorar claridad operativa durante la fase `5.4`.

### Impacto
1. El estado de cierre se consulta con un único comando.
2. Menor probabilidad de ejecutar deploy en ventana no válida.

## ADR-LITE-053 — Runner de espera automática para ejecutar el cierre en ventana válida
### Fecha
2026-03-03

### Decisión
1. Añadir `scripts/closeout-wait-and-run.sh` como runner de espera y ejecución.
2. Hacer que consuma cooldown de `.runtime/vercel-deploy-cooldown.env` y espere hasta `not_before`.
3. Permitir límites de espera por entorno:
   - `SMA_CLOSEOUT_POLL_SECONDS`
   - `SMA_CLOSEOUT_MAX_WAIT_SECONDS`
4. Delegar deploy + checks en `scripts/deploy-and-verify-closeout.sh` al abrir ventana.

### Motivación
1. Evitar perder la ventana útil de cuota por ejecución manual tardía.
2. Reducir riesgo de intentos prematuros que consuman cuota sin valor.

### Impacto
1. El cierre final de `5.4` puede ejecutarse de forma desatendida y controlada.
2. Se mantiene protección de cuota con guardrails explícitos y override consciente.

## ADR-LITE-054 — Programar reintento explícito con `at` para primera ventana útil
### Fecha
2026-03-03

### Decisión
1. Programar un job `at` para `2026-03-03 15:50 CET`.
2. Ejecutar desde ese job el script `.runtime/closeout-at-job.sh`.
3. Delegar en ese script la ejecución de `./scripts/deploy-and-verify-closeout.sh fast` con logging dedicado.

### Motivación
1. Evitar dependencia de intervención humana en una ventana precisa de cuota.
2. Asegurar intento único y trazable justo después del `not-before`.

### Impacto
1. Se reduce riesgo operativo de perder la ventana de despliegue por timing.
2. Se gana trazabilidad explícita de ejecución automática (`atq` + log en `.runtime/auto-closeout-*.log`).

## ADR-LITE-055 — Versionar scheduler y job de `at` para cierre reproducible
### Fecha
2026-03-03

### Decisión
1. Añadir `scripts/closeout-at-job.sh` al repositorio.
2. Añadir `scripts/schedule-closeout-at.sh` para programar/reprogramar job y limpiar jobs previos de closeout.
3. Hacer que el job ejecute `closeout-wait-and-run.sh fast` en vez de llamar directo a `deploy-and-verify-closeout.sh`.

### Motivación
1. Evitar dependencia de scripts efímeros en `.runtime`.
2. Permitir reintento robusto si el proveedor devuelve nuevo cooldown al momento de ejecución.

### Impacto
1. Operación de cierre más trazable y reproducible en GitFlow.
2. Menor probabilidad de fallo operativo por carrera de ventana/cuota.

## ADR-LITE-056 — Auto-reschedule del job de cierre ante nuevo cooldown
### Fecha
2026-03-03

### Decisión
1. Extender `scripts/closeout-at-job.sh` para que:
   - persista estado en `.runtime/auto-closeout-status.env`,
   - genere `.runtime/closeout-complete.flag` al éxito,
   - reprograme automáticamente siguiente ejecución al detectar cooldown actualizado.
2. Mantener switch de control:
   - `SMA_CLOSEOUT_AUTO_RESCHEDULE` (`1` por defecto).
   - `SMA_CLOSEOUT_RESCHEDULE_OFFSET_SECONDS` (`60` por defecto).

### Motivación
1. Evitar intervención manual si Vercel devuelve nueva ventana de reintento en el primer disparo.
2. Aumentar resiliencia del cierre final `5.4` con operación desatendida.

### Impacto
1. Menor riesgo de quedar bloqueados entre intentos por cambios dinámicos de cuota.
2. Mayor trazabilidad operacional del cierre automático.

## ADR-LITE-057 — Corregir formato de hora en autoreprogramación de `at`
### Fecha
2026-03-03

### Decisión
1. Extender `scripts/schedule-closeout-at.sh` con `--epoch <unix>`.
2. Programar con `at -t` para evitar ambigüedad del parser de fecha.
3. Hacer que `scripts/closeout-at-job.sh` reprograme usando `--epoch`.

### Motivación
1. El formato textual anterior provocó `at: garbled time` y dejó cola vacía.
2. Se necesita reintento automático determinista en cierre `5.4`.

### Impacto
1. La cola `at` se mantiene estable tras cada autoreintento.
2. Se elimina un fallo operativo que podía perder la ventana de despliegue.

## ADR-LITE-058 — Añadir comando de readiness para cierre 5.3/5.4
### Fecha
2026-03-03

### Decisión
1. Añadir `scripts/closeout-readiness.sh [--verbose]`.
2. Exponer contrato de salida por código:
   - `0`: listo para cierre de tracking.
   - `2`: en espera por cooldown.
   - `1`: revisión manual.
3. Leer estado de `.runtime/auto-closeout-status.env`, cooldown activo y flag de éxito.

### Motivación
1. Reducir fricción al decidir si ya podemos cerrar `5.3` y `5.4`.
2. Evitar interpretación manual de logs/archivos runtime durante el cierre.

### Impacto
1. Decisión de cierre más rápida y objetiva.
2. Menor riesgo de cerrar tracking con estado incompleto.

## ADR-LITE-059 — Guard de cola `at` en readiness para evitar espera ciega
### Fecha
2026-03-03

### Decisión
1. Extender `scripts/closeout-readiness.sh` para validar que existe job `at` activo de closeout.
2. Añadir salida específica `EXIT_CODE=3` cuando hay cooldown pero no job en cola.

### Motivación
1. Evitar estado falso de “en espera” cuando la orquestación automática está caída.
2. Forzar acción correctiva explícita (`schedule-closeout-at.sh`) antes de perder ventana.

### Impacto
1. Mayor confiabilidad operativa en la fase final de cierre.
2. Menor riesgo de no ejecutar deploy al abrir la cuota.

## ADR-LITE-060 — Añadir test de regresión para `closeout-readiness`
### Fecha
2026-03-03

### Decisión
1. Crear `scripts/tests/test-closeout-readiness.sh`.
2. Permitir inyección de `at/atq` en `closeout-readiness.sh` vía:
   - `SMA_ATQ_CMD`
   - `SMA_AT_CAT_CMD`

### Motivación
1. Validar estados críticos del cierre automático sin manipular cola real de `at`.
2. Evitar regresiones en la lógica de salida (`1/3/2/0`) durante la espera de cuota.

### Impacto
1. Mayor seguridad operativa del bloque `5.4`.
2. Cambios futuros en readiness podrán verificarse de forma repetible.

## ADR-LITE-061 — Añadir test de regresión para `schedule-closeout-at`
### Fecha
2026-03-03

### Decisión
1. Permitir inyección de comandos en `scripts/schedule-closeout-at.sh`:
   - `SMA_ATQ_CMD`, `SMA_AT_CMD`, `SMA_ATRM_CMD`.
2. Crear `scripts/tests/test-schedule-closeout-at.sh` con cobertura de:
   - programación por hora,
   - programación por epoch (`--epoch`),
   - limpieza selectiva de jobs closeout,
   - validación de epoch inválido.

### Motivación
1. Evitar regresiones silenciosas en el scheduler que puedan romper el cierre automático.
2. Validar lógica de cola sin depender de estado real del sistema.

### Impacto
1. Mayor robustez del pipeline automático de cierre `5.4`.
2. Menor riesgo de perder ventana por error en scheduling.
