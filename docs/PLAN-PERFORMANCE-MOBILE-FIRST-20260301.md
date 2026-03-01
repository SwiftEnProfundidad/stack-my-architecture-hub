# PLAN PERFORMANCE + MOBILE-FIRST (2026-03-01)

## Leyenda
- ✅ Hecho
- 🚧 En construccion (maximo 1)
- ⏳ Pendiente
- ⛔ Bloqueado

## Objetivo
Reducir tiempo de carga percibido en iPhone y consolidar base responsive/mobile-first en Hub + cursos sin romper navegación ni apertura de cursos.

## Fase 1 — Rendimiento runtime de cursos
1. ✅ Lazy render de Mermaid en iOS/Android/SDD (`IntersectionObserver` + warmup inicial).
2. ✅ Lazy highlighting de snippets en iOS/Android/SDD (highlight progresivo por viewport).
3. ✅ Conversión Markdown->`<img>` con `loading="lazy"` y `decoding="async"` en iOS/Android/SDD.
4. ✅ `content-visibility: auto` en bloques de lección para diferir render pesado fuera de viewport.
5. ✅ Rebuild + sync Hub + `build-hub --mode strict` en verde.

## Fase 2 — Ajuste UX mobile-first (Hub + cursos)
1. ✅ Ajustar layout mobile-first del Hub landing (tipografía, spacing y botones táctiles).
2. ✅ Revisar breakpoints de sidebar y controles sticky en cursos para iPhone pequeño.
3. ✅ Validar legibilidad y navegación en 3 temas visuales en viewport móvil.

## Fase 3 — Validación final + publicación
1. ✅ Smoke funcional final en rutas públicas (`/`, `/ios/`, `/android/`, `/sdd/`).
2. ✅ Medición comparativa de carga percibida móvil (antes/después) y registro en handoff.
3. ✅ Deploy Vercel del bloque completo.

## Fase 4 — Hardening runtime móvil (2026-03-01 tarde)
1. ✅ Carga diferida de `assistant-panel.js` en iOS/Android/SDD (solo bajo interacción del usuario).
2. ✅ Eliminación de llamadas `/health` en arranque en frío de los 3 cursos (validado con Playwright).
3. ✅ Sync Hub + `build-hub --mode strict` en verde con `assistant-panel.js` actualizado desde fuentes.
4. ✅ Carga no bloqueante de Mermaid + Highlight en iOS/Android/SDD (scripts CDN bajo demanda desde runtime, fuera del path crítico de arranque).
5. ✅ Pase responsive móvil final (iPhone) para compactar controles y reducir ruido visual en viewport estrecho (`<=480px` con etiquetas cortas y accesibles).

## Fase 5 — Micro-optimización del render de navegación (2026-03-01 noche)
1. ✅ Evitar reconstrucción global de navegación de lección en cada cambio de tema (`study-ux.js` en iOS/Android/SDD).
2. ✅ Renderizar/actualizar controles de navegación solo para la lección activa.
3. ✅ Rebuild + sync Hub + validación final (`strict`, `no drift`, `smoke`) en verde.

## Fase 6 — Diferir panel de acciones/estadísticas a idle (2026-03-01 noche)
1. ✅ Diferir inicialización de `study-ux-index-actions` a `requestIdleCallback` (fallback `setTimeout`) en iOS/Android/SDD.
2. ✅ Mantener funcionalidad y accesibilidad de acciones de progreso/export/import/reset sin cambios de comportamiento.
3. ✅ Rebuild + sync Hub + validación final (`strict`, `no drift`, `smoke`) en verde.

## Fase 7 — Decoración de badges del índice optimizada (2026-03-01 noche)
1. ✅ Indexar enlaces del índice por `topicId` para evitar recorridos completos innecesarios.
2. ✅ Diferir decoración global de badges (completado/repaso) a `idle`, manteniendo actualización inmediata del tema interactuado.
3. ✅ Rebuild + sync Hub + validación final (`strict`, `no drift`, `smoke`) en verde.
