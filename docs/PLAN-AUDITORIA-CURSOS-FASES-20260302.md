# PLAN AUDITORIA CURSOS POR FASES (2026-03-02)

## Leyenda
- ✅ Hecho
- 🚧 En construccion (maximo 1)
- ⏳ Pendiente
- ⛔ Bloqueado

## Objetivo
Ejecutar una auditoria profunda por `curso -> seccion -> leccion` para cerrar gaps pedagogicos, tecnicos y visuales en iOS, Android y SDD, con perfil publico monetizable en Vercel y perfil local completo sin perdida de contenido.

## Reglas no negociables
1. Orden de ejecucion: iOS -> Android -> SDD.
2. RED -> GREEN -> REFACTOR por cada leccion auditada.
3. Solo una tarea puede estar en `🚧`.
4. GitFlow estricto: ramas feature/chore, commits atomicos, PR y merge.
5. No romper arranque del Hub ni apertura de cursos.
6. Corregir ortografia/acentos en caliente sin registrar microhallazgos por tilde.
7. Convencion de fases unificada obligatoria en iOS y Android.
8. `Proyecto Final` obligatorio en todos los cursos (iOS, Android y SDD), con explicacion clara de alcance, criterios de evaluacion y expectativas de entrega.
9. El `Proyecto Final` debe exigir aplicacion integral de lo aprendido con enfoque hibrido narrativo/prosa + tecnico.

## Decisiones cerradas para este ciclo
1. Tracking unico activo en este archivo.
2. Politica de monetizacion: ocultar en build publico contenido interno/no didactico, manteniendolo en local/repo.
3. Modo de ejecucion: auditar y corregir en caliente por leccion.

## Convencion unificada de fases (iOS + Android)
1. ETAPA 0: CORE MOBILE
2. ETAPA 1: JUNIOR
3. ETAPA 2: MIDLEVEL
4. ETAPA 3: SENIOR
5. ETAPA 4: ARQUITECTO
6. ETAPA 5: MAESTRIA
7. ETAPA 6: PROYECTO FINAL

Notas:
1. SDD mantiene su estructura por semanas para el recorrido, pero debe exponer `Proyecto Final` obligatorio al cierre.
2. Esta convención se aplicará primero en labels de navegación y tracking; no requiere renombrar carpetas físicas para evitar regresiones.

## Migracion de planes anteriores
1. Planes revisados:
   - `PLAN-MAESTRO-IMPLEMENTACION-CURSOS-20260227.md`
   - `PLAN-COBERTURA-TOTAL-FLECHAS-20260227.md`
   - `PLAN-PERFORMANCE-MOBILE-FIRST-20260301.md`
   - `PLAN-CLOUD-PROGRESS-SYNC-20260301.md`
   - `PLAN-AUTH-PLATFORM-20260302.md`
   - `PLAN-AUTH-RECOVERY-20260302.md`
2. Estado de migracion:
   - tareas operativas cerradas: absorbidas como historico.
   - limpieza documental: pendiente de cierre en fase 0.3 para dejar `docs/` sin duplicados activos.

## Matriz operativa
- Archivo fuente: `docs/AUDITORIA-CURSOS-MATRIZ-20260302.tsv`
- Uso: registrar por fila severidad, gap, accion aplicada y estado de QA.

## Fase 0 - Tracking unico y baseline
| ID | Estado | Task | Entregable |
| --- | --- | --- | --- |
| 0.1 | ✅ | Crear plan unico activo y leyenda estandar | Este archivo versionado |
| 0.2 | ✅ | Generar matriz base `curso/seccion/leccion` | `AUDITORIA-CURSOS-MATRIZ-20260302.tsv` |
| 0.3 | ⏳ | Limpiar planes historicos cerrados para dejar `docs/` sin duplicados activos | `docs/` depurado |
| 0.4 | ⏳ | Actualizar `MASTER-TRACKER`, `SESSION-HANDOFF`, `HUB-STABILITY-LOG`, `ADR-LITE` al nuevo plan activo | Fuente de verdad sincronizada |

## Fase 1 - iOS (arranque obligatorio)
| ID | Estado | Task | Alcance |
| --- | --- | --- | --- |
| 1.1 | ✅ | Auditar + corregir ETAPA 0 leccion por leccion | `00-core-mobile/00-introduccion.md` -> `12-mobile-architect-parity-ios-android.md` |
| 1.2 | ✅ | Auditar + corregir ETAPA 1 | `01-fundamentos` |
| 1.3 | ✅ | Auditar + corregir ETAPA 2 | `02-integracion` |
| 1.4 | ✅ | Auditar + corregir ETAPA 3 | `03-evolucion` |
| 1.5 | ✅ | Auditar + corregir ETAPA 4 | `04-arquitecto` |
| 1.6 | ✅ | Auditar + corregir ETAPA 5 + anexos | `05-maestria`, `anexos` |
| 1.7 | ✅ | Materializar ETAPA 6 Proyecto Final iOS | alcance, rubrica, entregables, narrativa+tecnico, criterios de evaluacion |

## Fase 2 - Android
| ID | Estado | Task | Alcance |
| --- | --- | --- | --- |
| 2.1 | ✅ | Auditar + corregir bloque inicial | `00-nivel-cero`, `00-core-mobile` |
| 2.2 | ✅ | Auditar + corregir intermedio | `01-junior`, `02-midlevel` |
| 2.3 | ✅ | Auditar + corregir avanzado | `03-senior`, `04-maestria`, `05-proyecto-final`, `anexos` |
| 2.4 | ✅ | Endurecer Proyecto Final Android | explicacion de reto integral, rubrica y expectativas enterprise |

## Fase 3 - SDD
| ID | Estado | Task | Alcance |
| --- | --- | --- | --- |
| 3.1 | 🚧 | Auditar + corregir bloque base | `00-preparacion`, `01-roadmap`, semanas 01-08 |
| 3.2 | ⏳ | Auditar + corregir bloque avanzado | semanas 09-16, `anexos` |
| 3.3 | ⏳ | Aplicar perfil publico monetizable | excluir internos de `docs/`, `openspec/`, `00-informe` en build publico |
| 3.4 | ⏳ | Materializar Proyecto Final SDD obligatorio | brief, alcance, entregables, rubrica y defensa final |

## Fase 4 - Hub UX/UI + monetizacion
| ID | Estado | Task | Alcance |
| --- | --- | --- | --- |
| 4.1 | ⏳ | Auditar y corregir botones/navbars/menus responsive | Hub + cursos incrustados |
| 4.2 | ⏳ | Endurecer flujo auth/logout/acceso a cursos | evitar acceso sin sesion tras logout |
| 4.3 | ⏳ | Validar 3 temas visuales + mobile/desktop + iPhone | evidencia Playwright |

## Fase 5 - QA, GitFlow, cierre
| ID | Estado | Task | Entregable |
| --- | --- | --- | --- |
| 5.1 | ⏳ | Validaciones tecnicas por repo + Hub strict/drift/smoke | QA en verde |
| 5.2 | ⏳ | Commits atomicos + push + PR + merge por bloque | historial limpio |
| 5.3 | ⏳ | Deploy Vercel final con aprobacion explicita | produccion estable |
| 5.4 | ⏳ | Cierre: 0 tareas `🚧` y backlog residual priorizado | tracking final |
