# PLAN COBERTURA TOTAL FLECHAS MERMAID

Fecha: 2026-02-27

## Leyenda
- ✅ Hecho
- 🚧 En construccion (maximo 1)
- ⏳ Pendiente
- ⛔ Bloqueado

## Objetivo
Aplicar semantica explicita de 4 flechas Mermaid (`-->`, `-.->`, `-.o`, `--o`) en el recorrido completo de lecciones con Mermaid, ejecutando en orden iOS -> Android -> SDD y publicando en Hub sin regresion runtime.

## Fases
1. ✅ Fase 1 — iOS (normalizacion completa de lecciones con Mermaid).
2. ✅ Fase 2 — Android (normalizacion completa de lecciones con Mermaid).
3. ✅ Fase 3 — SDD (normalizacion completa de lecciones con Mermaid, excluyendo `00-informe`).
4. ✅ Fase 4 — Hub (sync selectivo de bundles + tracking + cierre GitFlow).

## Task
1. ✅ RED iOS: inventario de cobertura y brecha de flechas en lecciones con Mermaid.
2. ✅ GREEN iOS: insercion de bloque semantico auto en lecciones pendientes.
3. ✅ REFACTOR iOS: estandar de redaccion y commits atomicos por etapa.
4. ✅ RED Android: inventario de cobertura y brecha.
5. ✅ GREEN Android: normalizacion de lecciones pendientes.
6. ✅ REFACTOR Android: commits atomicos junior/midlevel.
7. ✅ RED SDD: inventario de cobertura en lecciones con Mermaid.
8. ✅ GREEN SDD: normalizacion por semanas con bloque semantico.
9. ✅ REFACTOR SDD: commits atomicos por carpeta semanal.
10. ✅ Validacion tecnica iOS/Android/SDD (build + checks en verde).
11. ✅ Cierre GitFlow de repos fuente (push, PR, merge).
12. ✅ Sync Hub + `no drift (6/6)` + smoke runtime + tracking docs.

## TODO interno (autogestion)
1. [x] Convertir `🚧` de Fase 4/Task 12 a `✅` tras cierre tecnico del bloque.
2. [x] Consolidar evidencia final (PR/commit) en `MASTER-TRACKER` y `SESSION-HANDOFF`.
