# STACK ARCHITECTURE MASTER TRACKER

Fecha de actualización: 2026-03-08

## Leyenda
- ✅ Hecho
- 🚧 En construccion (maximo 1)
- ⏳ Pendiente
- ⛔ Bloqueado

## Objetivo global
Mantener una única fuente de verdad operativa para el ecosistema `Hub + iOS + Android + SDD`, con documentación estable, trazable y apta para operación enterprise.

## Repos activos
1. `stack-my-architecture-hub`
2. `stack-my-architecture-SDD`
3. `stack-my-architecture-ios`
4. `stack-my-architecture-android`

## Fuente de verdad estable
1. `docs/STACK-ARCHITECTURE-MASTER-TRACKER.md`
2. `docs/HUB-STABILITY-LOG.md`
3. `docs/SESSION-HANDOFF.md`
4. `docs/DECISIONS-ADR-LITE.md`
5. `docs/GUIA-DIAGRAMAS-ARQUITECTURA-CAPAS-Y-FLECHAS.md`
6. `docs/TEMPLATE-DIAGRAMA-ARQUITECTURA-MERMAID.md`
7. `docs/PROGRESS-SYNC-SUPABASE.sql`
8. `docs/PLAN-ENTITLEMENTS-DASHBOARD-20260308.md`

## Estado consolidado
- ✅ Hub estable y publicado en `https://architecture-stack.vercel.app`.
- ✅ Cursos `iOS`, `Android` y `SDD` sincronizados en el Hub.
- ✅ Auth y progreso cloud ligados a usuario autenticado.
- ✅ Runtime móvil/responsive validado en publicación.
- ✅ Versionado de assets determinista y smoke suites endurecidas.
- ✅ E2E autenticada cross-device validada manualmente contra producción.
- ✅ Artefactos transitorios de seguimiento consolidados a un set enterprise mínimo.

## Política operativa vigente
1. Solo estos documentos `docs/` actúan como tracking estable.
2. Los planes cerrados, backlog residual, auditorías puntuales y trackers temporales no deben permanecer versionados si ya no gobiernan el producto.
3. Los cursos deben publicar solo documentación estable del alumno: informe, matriz de competencias, rúbrica y scorecard.
4. El Hub no debe depender de GitHub Actions mientras no haya billing operativo.
5. Cada bloque nuevo se abre con GitFlow real y una sola tarea `🚧`.

## Bloque actual
- 🚧 Entitlements + Dashboard del estudiante v1 en Fase 2 (dashboard operativo con etapa, checkpoints y continuidad).

## Siguiente paso operativo
1. Terminar el dashboard operativo real con continuidad por curso y CTA más finos.
2. Validar con cuenta real los flujos `anonymous`, `student`, `trial` y `admin`.
3. Cerrar notas/bookmarks + continuidad recomendada antes del primer ciclo GitFlow de este bloque.
