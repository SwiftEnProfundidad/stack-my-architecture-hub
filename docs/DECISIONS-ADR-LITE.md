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
