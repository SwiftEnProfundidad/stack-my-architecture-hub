# PLAN EMPLEABILIDAD + RIGOR ENTERPRISE

Fecha: 2026-02-27

## Leyenda
- ✅ Hecho
- 🚧 En construccion (maximo 1)
- ⏳ Pendiente
- ⛔ Bloqueado

## Objetivo
Cerrar brechas de aprendizaje para que el alumno progrese de junior a maestria con evidencia real de competencia, defensa tecnica y rigor enterprise.

## Prioridad fijada
1. Empleabilidad + defensa tecnica.
2. Rigor enterprise maximo (sin sacrificar la prioridad 1).

## Fases
1. ✅ Fase 1 — Fundaciones de evaluacion (matriz de competencias, rubricas de gate y scorecard de empleabilidad por curso).
2. ✅ Fase 2 — Validacion automatica (gates de aprendizaje + semantica de diagramas).
3. ✅ Fase 3 — Integracion Hub (estandar visual y plantillas de arquitectura por capas/modulos/features).
4. 🚧 Fase 4 — Evidencia operativa (checks, sync selectivo Hub, tracking, handoff y cierre GitFlow).

## Task
1. ✅ RED iOS: definir artefactos base de empleabilidad/gates y expectativas minimas por fase.
2. ✅ GREEN iOS: crear `MATRIZ-COMPETENCIAS`, `RUBRICA-GATES-POR-FASE`, `SCORECARD-EMPLEABILIDAD`.
3. ✅ REFACTOR iOS: agregar validadores (`validate-learning-gates.py`, `validate-diagram-semantics.py`) con criterios reutilizables.
4. ✅ RED Android: validar necesidad de artefactos equivalentes.
5. ✅ GREEN Android: crear artefactos base y validadores equivalentes.
6. ✅ REFACTOR Android: ajustar redaccion y coherencia semantica de criterios por etapa.
7. ✅ RED SDD: inventario de brechas para artefactos base y validacion.
8. ✅ GREEN SDD: crear artefactos base y validadores equivalentes.
9. ✅ REFACTOR SDD: calibrar criterios enterprise y evidencia de defensa tecnica.
10. ✅ Hub: publicar styleguide/plantillas de diagrama por capas (core/domain, application, interface, infrastructure).
11. ✅ QA: ejecutar checks por repo + smoke Hub sin regresion.
12. 🚧 GitFlow: commits atomicos, push, PR, merge y actualizacion de tracker/handoff.

## Regla operativa
Solo una fase puede estar en `🚧` al mismo tiempo.
