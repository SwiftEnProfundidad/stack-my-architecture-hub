# Plan Entitlements + Dashboard 2026-03-08

## Leyenda
- ✅ Hecho
- 🚧 En construccion (maximo 1)
- ⏳ Pendiente
- ⛔ Bloqueado

## Objetivo
Convertir el Hub en una plataforma operable y monetizable con:
- acceso teaser + bloqueo por entitlement
- panel admin web
- dashboard completo del estudiante
- persistencia cloud por usuario
- base lista para futura integracion de pagos

## Fase 0 - Base y contrato de datos
| ID | Estado | Task |
| --- | --- | --- |
| 0.1 | ✅ | Diseñar esquema Supabase de entitlements, planes, teasers, notas y bookmarks |
| 0.2 | ✅ | Definir contratos API Hub para authz, dashboard y admin |
| 0.3 | ✅ | Preparar migraciones SQL y seeds iniciales |

## Fase 1 - Enforcement de acceso
| ID | Estado | Task |
| --- | --- | --- |
| 1.1 | ✅ | Añadir runtime de acceso por curso y leccion |
| 1.2 | ✅ | Implementar teaser + bloqueo visual coherente |
| 1.3 | ✅ | Restringir apertura de cursos y lecciones sin entitlement |
| 1.4 | ✅ | Mantener bypass local seguro para desarrollo |

## Fase 2 - Dashboard estudiante
| ID | Estado | Task |
| --- | --- | --- |
| 2.1 | ✅ | Crear home autenticada del estudiante |
| 2.2 | 🚧 | Mostrar progreso por curso, etapa, checkpoints y siguiente paso |
| 2.3 | ✅ | Añadir notas privadas y bookmarks por leccion |
| 2.4 | ⏳ | Integrar CTA de continuidad y acceso rapido a lecciones |

## Fase 3 - Panel admin
| ID | Estado | Task |
| --- | --- | --- |
| 3.1 | ✅ | Crear panel admin protegido por rol |
| 3.2 | ✅ | Gestionar usuarios, planes y entitlements |
| 3.3 | ✅ | Gestionar teasers por curso/leccion |
| 3.4 | ✅ | Registrar auditoria minima de cambios manuales |

## Fase 4 - QA y despliegue
| ID | Estado | Task |
| --- | --- | --- |
| 4.1 | ⏳ | Validar flujos anonimo, student, trial y admin |
| 4.2 | ⏳ | Validar sync cross-device de progreso, notas y bookmarks |
| 4.3 | ⏳ | Validar mobile-first y responsive del dashboard y panel admin |
| 4.4 | ⏳ | Sync Hub, GitFlow completo y despliegue Vercel |

## Evidencia reciente
- ✅ Migracion `hub_entitlements_dashboard_v1` aplicada en Supabase con tablas `hub_*` y seeds teaser iniciales.
- ✅ APIs nuevas del Hub (`entitlements`, `dashboard`, `student-notes`, `student-bookmarks`, `admin`) con tests Node en verde.
- ✅ Runtime de cursos (`iOS`, `Android`, `SDD`) ya resuelve acceso por entitlement, teaser y bypass local seguro.
- ✅ Home del Hub ya muestra estado local resuelto, catalogo con acceso y dashboard base listo para cuenta autenticada.
- ✅ Dashboard ya expone etapa actual y checkpoints inferidos por curso en la API y en la UI del Hub.
- ✅ `trial` queda acotado a teaser: no concede acceso completo aunque exista entitlement con estado `trial`.
- ✅ Panel admin ya opera usuarios, roles, entitlements, teasers y auditoria reciente.
- ✅ `./scripts/build-hub.sh --mode strict` en verde tras integrar el bloque.
