# Auditoría profunda de cursos y lecciones

Fecha: 2026-02-26

## Alcance auditado

Repos canónicos analizados (fuente + publicado):

1. `stack-my-architecture-ios`
2. `stack-my-architecture-android`
3. `stack-my-architecture-SDD`

Cobertura ejecutada:

1. Revisión estática línea a línea en Markdown (estructura, fences, Mermaid, snippets y anexos).
2. Validación técnica por scripts nativos de cada repo.
3. Validación visual navegada en Hub (`ios/index.html`, `android/index.html`, `sdd/index.html`) con Playwright CLI y 3 estilos (`enterprise`, `bold`, `paper`) en `light/dark`.

## Métricas de base

1. iOS: 118 archivos Markdown, 38,611 líneas, 152 bloques Mermaid.
2. Android: 78 archivos Markdown, 9,923 líneas, 17 bloques Mermaid.
3. SDD: 186 archivos Markdown, 22,535 líneas, 171 bloques Mermaid.
4. Fences sin cierre (` ``` ` impar): 0 en los 3 cursos.

## Resultado por severidad

## P1 (crítico) — resuelto

1. SDD: referencia inline inválida en `openspec/changes/drafts/intake-ticket.md` apuntando a ruta local temporal `/tmp/helpdesk-board-export.md`.
2. Acción aplicada: normalizada a nombre de archivo local temporal sin ruta absoluta.
3. Estado actual: `scripts/check-links.py` en SDD vuelve a `PASS`.

## P2 (medio) — abiertos y trazados

1. iOS mantiene backlog pedagógico no bloqueante ya conocido por QA:
- Continuidad pedagógica P2: 9
- Saltos/prerrequisitos/redundancias P2: 10
- Plantilla pedagógica P2: 62
- Mermaid semántica P2: 0 (cerrado en fase de backlog posterior, PR iOS #5)
- Trazabilidad scaffold P2: 4

2. SDD: `scripts/validate-pedagogy.py` marca masivamente listas/tablas como “formato chuleta”.
- Clasificación: deuda de calibración del validador (no evidencia de rotura funcional de contenido).
- Impacto: no bloquea build ni publicación, pero conviene tunear la regla para reducir falsos positivos.

## P3 (mejora UX) — aplicadas

1. Índice de anexos creado en los 3 cursos (`anexos/README.md`) para navegación única y seguimiento pedagógico.
2. Guía explícita de semántica de flechas Mermaid añadida en anexos para reforzar interpretación uniforme.
3. Cobertura de los 4 tipos de flecha ahora representada en snippets Mermaid en los 3 cursos.

## Validación de flechas Mermaid

Convención validada:

1. `-->` Dependencia directa (runtime)
2. `-.->` Wiring / configuración
3. `-.o` Contrato / abstracción
4. `--o` Salida / propagación

Conteo de uso tras ajustes:

1. iOS: `-->` 751, `-.->` 55, `-.o` 6, `--o` 1
2. Android: `-->` 82, `-.->` 1, `-.o` 2, `--o` 1
3. SDD: `-->` 730, `-.->` 67, `-.o` 13, `--o` 1

## Validación visual de temas

Evidencia Playwright en `output/playwright/`.

Resultado consolidado:

1. 6/6 combinaciones por curso auditadas (`3 estilos x 2 temas`).
2. Contraste texto/fondo (cuerpo) en rango 12.44–19.75 (WCAG AA: 6/6 en cada curso).
3. Leyenda de 4 semánticas presente y consistente en 6/6 combinaciones por curso.
4. Sin regresión visual detectada en cajas, flechas y contraste base en `ios`, `android` y `sdd`.

## Estado de ANEXOS y organización

Se detectó ausencia de índice raíz en anexos (los 3 cursos). Queda corregido con `anexos/README.md` y mapa por categorías.

Estructura propuesta aplicada para seguimiento del alumno:

1. Fundamentos y recuperación.
2. Consolidación por bloques/etapas.
3. Diagramas y semántica visual.
4. Plantillas o guías operativas.
5. Cierre/proyecto final.

## Conclusión de cierre

1. No quedan P0/P1 abiertos tras la corrección aplicada en SDD.
2. Calidad visual de temas y semántica de leyenda Mermaid validada en runtime del Hub.
3. Queda backlog P2 no bloqueante (pedagógico/calibración de validadores) para iteración posterior.
