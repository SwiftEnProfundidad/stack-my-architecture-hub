# Plan Modo entrevista tecnica v1 2026-03-09

## Leyenda
- ✅ Hecho
- 🚧 En construccion (maximo 1)
- ⏳ Pendiente
- ⛔ Bloqueado

## Objetivo
Convertir el contenido de empleabilidad, defensa tecnica y cierre profesional ya existente en `iOS`, `Android` y `SDD` en una experiencia operativa dentro del producto:
- punto de entrada visible desde el Hub y el dashboard
- apertura directa del curso en modo entrevista
- panel de entrenamiento dentro del curso con preguntas, rubricas y enlaces fuente

## Fase 0 - Contrato y curacion
| ID | Estado | Task |
| --- | --- | --- |
| 0.1 | ✅ | Definir el contrato UX y curar los packs de entrevista por curso reutilizando contenido real |
| 0.2 | ✅ | Registrar por curso las lecciones fuente de entrevista, rubrica y defensa tecnica |

## Fase 1 - Hub
| ID | Estado | Task |
| --- | --- | --- |
| 1.1 | ✅ | Añadir seccion de Modo entrevista en el dashboard y el catalogo |
| 1.2 | ✅ | Permitir apertura directa del curso en modo entrevista |

## Fase 2 - Runtime de cursos
| ID | Estado | Task |
| --- | --- | --- |
| 2.1 | ✅ | Añadir boton `Entrevista` a la topbar del curso |
| 2.2 | ✅ | Renderizar panel con preguntas, rubric/checklist y enlaces a lecciones fuente |
| 2.3 | ✅ | Soportar autoapertura por query param y mantener responsive/mobile-first |

## Fase 3 - QA y cierre
| ID | Estado | Task |
| --- | --- | --- |
| 3.1 | ✅ | Validar Hub y cursos en escritorio y mobile con Playwright |
| 3.2 | ✅ | Validar build strict y sincronizacion del runtime al Hub |
| 3.3 | ✅ | Actualizar tracker/handoff y dejar el bloque listo para GitFlow |
