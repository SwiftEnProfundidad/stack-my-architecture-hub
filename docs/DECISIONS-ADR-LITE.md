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
