# PLAN AUTH PLATFORM (2026-03-02)

## Leyenda
- ✅ Hecho
- 🚧 En construccion (maximo 1)
- ⏳ Pendiente
- ⛔ Bloqueado

## Objetivo
Pasar de perfil compartido por enlace a cuenta de usuario con registro/login y progreso persistente por usuario en cloud, manteniendo compatibilidad sin regresiones en iOS/Android/SDD + Hub.

## Fase 1 — Contrato y backend auth (Hub)
1. ✅ RED: crear tests de contrato para `api/auth-sync` (`config`, `signup`, `login`, `me`, `refresh`, `logout`).
2. ✅ GREEN: implementar `api/auth-sync.js` con Supabase Auth REST + validaciones de payload/errores.
3. ✅ REFACTOR: endurecer normalización de respuestas y CORS.

## Fase 2 — UX de acceso (Hub)
1. ✅ Crear `auth/index.html` (pantalla pre-acceso con CTA a registro/login).
2. ✅ Crear `auth/register.html` (email/password + estado de confirmación por email).
3. ✅ Crear `auth/login.html` (email/password + cierre de sesión y estado actual).
4. ✅ Integrar identidad visual PUMUKI en pantallas auth sin romper móvil.

## Fase 3 — Integración de sesión con progreso cloud (iOS/Android/SDD)
1. ✅ RED: ampliar tests del backend de progreso para flujo autenticado con `Authorization`.
2. ✅ GREEN: actualizar `api/progress-sync.js` para resolver `profileKey` por `user.id` autenticado.
3. ✅ GREEN: actualizar `assets/study-ux.js` en iOS/Android/SDD para usar sesión auth y enviar bearer token en sync.
4. ✅ REFACTOR: alinear `assets/course-switcher.js` en iOS/Android/SDD para enlace de acceso auth consistente.

## Fase 4 — Validación técnica y publicación
1. ✅ Ejecutar suite Node de Hub (`test-progress-sync`, `test-auth-sync`, `test-assistant-bridge-byok`).
2. ✅ Rebuild iOS/Android/SDD y sync Hub (`build-hub --mode strict`, `check-selective-sync-drift`, `smoke-hub-runtime`).
3. ✅ Validación login/confirmación email en móvil/escritorio con callback estable:
   - hardening de `emailRedirectTo` para evitar `localhost` en confirmaciones emitidas desde entorno local.
   - login preparado para consumir `#access_token`/`#refresh_token` del callback de Supabase y cerrar sesión de confirmación sin pasos manuales.
4. ✅ Cierre GitFlow end-to-end (push + PR + merge en 4 repos cuando aplique) + deploy Vercel.

## Fase 5 — Tracking y continuidad
1. ✅ Actualizar `STACK-ARCHITECTURE-MASTER-TRACKER.md` con evidencias del bloque.
2. ✅ Actualizar `HUB-STABILITY-LOG.md` con riesgo/regresión/post-fix.
3. ✅ Actualizar `SESSION-HANDOFF.md` dejando tablero con una sola tarea en construcción.
4. ✅ Actualizar `DECISIONS-ADR-LITE.md` con ADR de autenticación de plataforma.

## Cierre del bloque
1. ✅ Implementación técnica cerrada en los 4 repos.
2. ✅ Publicación productiva realizada:
   - `https://architecture-stack.vercel.app`
   - `https://architecture-stack-knp9zjmp4-merlosalbarracins-projects.vercel.app`
3. ✅ Verificación de rutas públicas `200`: `/`, `/ios/`, `/android/`, `/sdd/`, `/auth/index.html`, `/auth/register.html`, `/auth/login.html`, `/auth/config`.
