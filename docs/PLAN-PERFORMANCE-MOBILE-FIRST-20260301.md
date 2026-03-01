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
4. 🚧 Pase responsive móvil final (iPhone) para compactar controles y reducir ruido visual en viewport estrecho.
