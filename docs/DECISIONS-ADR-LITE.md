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
5. Plan operativo de ejecución documentado en `docs/PLAN-COBERTURA-TOTAL-FLECHAS-20260227.md`.

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
