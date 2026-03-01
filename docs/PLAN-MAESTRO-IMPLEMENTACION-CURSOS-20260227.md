# PLAN MAESTRO IMPLEMENTACION CURSOS

Fecha: 2026-02-27
Owner operativo: Hub (coordinacion cross-repo)

## Leyenda
- ✅ Hecho
- 🚧 En construccion (maximo 1)
- ⏳ Pendiente
- ⛔ Bloqueado

## Objetivo
Cerrar todas las brechas pedagogicas y tecnicas en iOS, Android y SDD para que el alumno pueda progresar de junior a maestria con evidencia real de competencia, defensa tecnica y rigor enterprise.

## Prioridad fijada
1. Empleabilidad + defensa tecnica.
2. Rigor enterprise maximo (sin sacrificar la prioridad 1).

## Reglas no negociables
1. Orden de ejecucion: iOS -> Android -> SDD.
2. Cada bloque se ejecuta en RED -> GREEN -> REFACTOR.
3. Solo una task puede estar en `🚧`.
4. GitFlow completo por repo: rama, commits atomicos, push, PR, merge.
5. No romper arranque del Hub ni apertura de cursos desde la app.
6. SDD debe cumplir `AGENTS.md` antes de merge.

## Alcance obligatorio
1. Lecciones reales del curso (no solo `00-informe`).
2. Mermaid: semantica explicita de flechas `-->`, `-.->`, `-.o`, `--o`.
3. Diagramas por capas: `core/domain`, `application`, `interface`, `infrastructure`.
4. Snippets coherentes con diagramas y ejecutables cuando aplique.
5. QA visual en temas disponibles y QA tecnico en scripts de cada repo.
6. Organizacion de anexos para seguimiento del alumno.
7. Publicacion final en Hub sin regresion.

## Criterio de salida global
1. 0 P0 abiertos en iOS, Android y SDD.
2. Lecciones con Mermaid auditadas y corregidas segun checklist.
3. QA tecnico en verde por repo + Hub strict/smoke en verde.
4. Tracking docs actualizados con evidencia exacta (PR, commit, fecha).
5. Estado final con 0 tareas en `🚧`.

## Fase 0 - Arranque y baseline
| ID | Estado | Task | Entregable | Repo |
| --- | --- | --- | --- | --- |
| 0.1 | ✅ | Inventario exacto de lecciones por curso con Mermaid/snippets/anexos | Lista `curso -> seccion -> leccion -> archivo` | iOS/Android/SDD |
| 0.2 | ✅ | Matriz de brechas por leccion (texto, mermaid, snippet, visual, anexos) | Backlog tecnico-pedagogico P0/P1/P2 | iOS/Android/SDD |
| 0.3 | ✅ | Definir lotes atomicos por impacto y riesgo | Plan de ejecucion por lotes | Hub |
| 0.4 | ✅ | Registrar baseline en tracker/handoff | Estado inicial trazable | Hub |

## Fase 1 - iOS RED
| ID | Estado | Task | Entregable |
| --- | --- | --- | --- |
| 1.1 | ✅ | Auditar semantica de flechas por leccion iOS | Lista de lecciones iOS con gap por flecha |
| 1.2 | ✅ | Auditar capas/modulos/features en diagramas iOS | Lista de lecciones con estructura incompleta |
| 1.3 | ✅ | Auditar coherencia diagrama <-> snippet iOS | Lista de snippets a corregir |
| 1.4 | ✅ | Auditar narrativa pedagogica iOS (contexto, practica, comprobacion) | Lista de huecos didacticos por leccion |

## Fase 2 - iOS GREEN
| ID | Estado | Task | Entregable |
| --- | --- | --- | --- |
| 2.1 | ✅ | Corregir lecciones iOS Etapa 0 (base arquitectonica) | Mermaid + texto + snippets corregidos |
| 2.2 | ✅ | Corregir lecciones iOS Etapa 1 (fundamentos) | Mermaid + texto + snippets corregidos |
| 2.3 | ✅ | Corregir lecciones iOS Etapa 2 (integracion) | Mermaid + texto + snippets corregidos |
| 2.4 | ✅ | Corregir lecciones iOS Etapa 3 (evolucion) | Mermaid + texto + snippets corregidos |
| 2.5 | ✅ | Corregir lecciones iOS Etapa 4 (arquitecto) | Mermaid + texto + snippets corregidos |
| 2.6 | ✅ | Corregir lecciones iOS Etapa 5 (maestria) | Mermaid + texto + snippets corregidos |
| 2.7 | ✅ | Integrar anexos iOS y enlaces de continuidad | Flujo de estudio sin saltos |

## Fase 3 - iOS REFACTOR + QA + GitFlow
| ID | Estado | Task | Entregable |
| --- | --- | --- | --- |
| 3.1 | ✅ | Unificar estilo y semantica en todo iOS | Consistencia visual y narrativa |
| 3.2 | ✅ | Ejecutar validaciones iOS (build/checks/scripts) | Evidencia en verde |
| 3.3 | ✅ | QA visual iOS en temas disponibles | Reporte visual sin regresiones |
| 3.4 | ✅ | Commit atomicos + PR iOS + merge develop | Cierre GitFlow iOS |

## Fase 4 - Android RED
| ID | Estado | Task | Entregable |
| --- | --- | --- | --- |
| 4.1 | ✅ | Auditar semantica de flechas por leccion Android | Lista de lecciones Android con gap |
| 4.2 | ✅ | Auditar capas/modulos/features en Android | Lista de lecciones con estructura incompleta |
| 4.3 | ✅ | Auditar coherencia diagrama <-> snippet Android | Lista de snippets a corregir |
| 4.4 | ✅ | Auditar narrativa pedagogica Android | Lista de huecos didacticos |

## Fase 5 - Android GREEN
| ID | Estado | Task | Entregable |
| --- | --- | --- | --- |
| 5.1 | ✅ | Corregir lecciones Android Nivel Cero + Core Mobile | Mermaid + texto + snippets corregidos |
| 5.2 | ✅ | Corregir lecciones Android Junior | Mermaid + texto + snippets corregidos |
| 5.3 | ✅ | Corregir lecciones Android Midlevel | Mermaid + texto + snippets corregidos |
| 5.4 | ✅ | Corregir lecciones Android Senior | Mermaid + texto + snippets corregidos |
| 5.5 | ✅ | Corregir lecciones Android Maestria + Proyecto Final | Mermaid + texto + snippets corregidos |
| 5.6 | ✅ | Integrar anexos Android y enlaces de continuidad | Flujo de estudio sin saltos |

## Fase 6 - Android REFACTOR + QA + GitFlow
| ID | Estado | Task | Entregable |
| --- | --- | --- | --- |
| 6.1 | ✅ | Unificar estilo y semantica en Android | Consistencia visual y narrativa |
| 6.2 | ✅ | Ejecutar validaciones Android (links/build/scripts) | Evidencia en verde |
| 6.3 | ✅ | QA visual Android en temas disponibles | Reporte visual sin regresiones |
| 6.4 | ✅ | Commit atomicos + PR Android + merge develop | Cierre GitFlow Android |

## Fase 7 - SDD RED
| ID | Estado | Task | Entregable |
| --- | --- | --- | --- |
| 7.1 | ✅ | Auditar semantica de flechas por semana/leccion SDD | Lista de gaps por archivo |
| 7.2 | ✅ | Auditar capas/modulos/features en diagramas SDD | Lista de estructura incompleta |
| 7.3 | ✅ | Auditar coherencia diagrama <-> snippet SDD | Lista de snippets a corregir |
| 7.4 | ✅ | Auditar narrativa pedagogica y trazabilidad OpenSpec/BDD/TDD | Lista de huecos didacticos |

## Fase 8 - SDD GREEN
| ID | Estado | Task | Entregable |
| --- | --- | --- | --- |
| 8.1 | ✅ | Corregir semanas 01-04 | Mermaid + texto + snippets corregidos |
| 8.2 | ✅ | Corregir semanas 05-08 | Mermaid + texto + snippets corregidos |
| 8.3 | ✅ | Corregir semanas 09-12 | Mermaid + texto + snippets corregidos |
| 8.4 | ✅ | Corregir semanas 13-16 | Mermaid + texto + snippets corregidos |
| 8.5 | ✅ | Integrar anexos SDD y enlaces de continuidad | Flujo de estudio sin saltos |

## Fase 9 - SDD REFACTOR + QA + GitFlow
| ID | Estado | Task | Entregable |
| --- | --- | --- | --- |
| 9.1 | ✅ | Unificar estilo y semantica en SDD | Consistencia visual y narrativa |
| 9.2 | ✅ | Ejecutar checklist AGENTS completo SDD | Evidencia tecnica en verde |
| 9.3 | ✅ | QA visual SDD en temas disponibles | Reporte visual sin regresiones |
| 9.4 | ✅ | Commit atomicos + PR SDD + merge develop | Cierre GitFlow SDD |

## Fase 10 - Hub integracion y publicacion
| ID | Estado | Task | Entregable |
| --- | --- | --- | --- |
| 10.1 | ✅ | Sync selectivo iOS tras merge | Hub actualizado sin drift |
| 10.2 | ✅ | Sync selectivo Android tras merge | Hub actualizado sin drift |
| 10.3 | ✅ | Sync selectivo SDD tras merge | Hub actualizado sin drift |
| 10.4 | ✅ | Verificar guardrail assistant panel | BYOK preservado |
| 10.5 | ✅ | Validar Hub (`build-hub --mode strict`) | Build Hub en verde |
| 10.6 | ✅ | Validar drift + smoke runtime | `no drift (6/6)` + smoke OK |
| 10.7 | ✅ | Commit atomicos + PR Hub + merge develop | Cierre GitFlow Hub |

## Fase 11 - Cierre operativo y despliegue
| ID | Estado | Task | Entregable |
| --- | --- | --- | --- |
| 11.1 | ✅ | Actualizar `MASTER-TRACKER`, `SESSION-HANDOFF`, `HUB-STABILITY-LOG`, `ADR` con evidencia final | Tracking completo y auditable |
| 11.2 | ✅ | Validacion final end-to-end en runtime local/publico | Rutas y asistente sin regresion |
| 11.3 | ⛔ | Despliegue final en Vercel (una sola ejecucion final) | Bloqueado por cuota diaria (`api-deployments-free-per-day`) |
| 11.4 | ✅ | Cierre de backlog: 0 `🚧`, pendientes justificados o movidos | Estado operativo limpio |

## Fase 12 - Correccion visual Mermaid post-cierre
| ID | Estado | Task | Entregable |
| --- | --- | --- | --- |
| 12.1 | ✅ | Reparar Mermaid roto por sintaxis `-.o` en lecciones auto-gapfix | Diagramas renderizados sin `Syntax error in text` |
| 12.2 | ✅ | Rediseñar bloque por capas con semantica robusta y 4 flechas validas | Mermaid con `-->`, `-.->`, `==>`, `--o` + leyenda alineada |
| 12.3 | ✅ | Ajustar tooling de render + validador de semantica | `build-html.py` y `validate-diagram-semantics.py` consistentes |
| 12.4 | ✅ | Cerrar GitFlow iOS + Android y sincronizar Hub | PRs cerradas + Hub strict/drift/smoke en verde |

## Dependencias criticas
1. No empezar Android GREEN sin cerrar iOS REFACTOR+QA+merge.
2. No empezar SDD GREEN sin cerrar Android REFACTOR+QA+merge.
3. No ejecutar despliegue final hasta que Hub strict/drift/smoke esten en verde.
4. Si aparece bloqueo tecnico, marcar task como `⛔` y abrir subtask de desbloqueo.

## Evidencia de ejecucion
1. Inventario + matriz:
   - `docs/INVENTARIO-CROSS-COURSE-LECCIONES-ANEXOS-20260227.tsv`
   - `docs/MATRIZ-BRECHAS-CROSS-COURSE-20260227.tsv`
   - `docs/REVISION-MANUAL-BRECHAS-20260227.md`
   - `docs/PLAN-LOTES-ATOMICOS-20260227.md`
2. GitFlow por repo:
   - iOS PR `#13` -> merge `1fbb0c8`
   - iOS PR `#14` -> merge `e2a2e91`
   - Android PR `#10` -> merge `d183d1e`
   - Android PR `#11` -> merge `03db5b8`
   - SDD PR `#11` -> merge `aa1e4cf`
   - SDD PR `#12` -> merge `7deaa30`
   - Hub PR `#36` -> merge `c0b65a5`
3. Validacion final Hub:
   - `./scripts/build-hub.sh --mode strict` -> PASS
   - `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`
   - `./scripts/smoke-hub-runtime.sh` -> OK
4. Bloqueo externo:
   - `npx -y vercel deploy --prod --yes` -> `api-deployments-free-per-day`
