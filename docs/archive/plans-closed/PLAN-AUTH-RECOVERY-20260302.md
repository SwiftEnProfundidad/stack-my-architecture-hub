# PLAN AUTH RECOVERY (2026-03-02)

## Leyenda
- ✅ Hecho
- 🚧 En construccion (maximo 1)
- ⏳ Pendiente
- ⛔ Bloqueado

## Objetivo
Completar el flujo de cuenta con operaciones de soporte de acceso: reenviar confirmacion y recuperar contrasena, con contrato testeado y UX publicada en Hub.

## Fase 1 — Contrato API (RED)
1. ✅ Extender tests de `api/auth-sync` para rutas `resend` y `recover`.
2. ✅ Validar payload obligatorio y mapeo de errores de proveedor.

## Fase 2 — Implementacion API (GREEN)
1. ✅ Implementar `route=resend` en `api/auth-sync.js`.
2. ✅ Implementar `route=recover` en `api/auth-sync.js`.
3. ✅ Exponer rewrites en `vercel.json` para `/auth/resend` y `/auth/recover`.

## Fase 3 — Cliente y UX (REFACTOR)
1. ✅ Extender `assets/auth-client.js` con `resendConfirmation()` y `recoverPassword()`.
2. ✅ Actualizar `auth/register.html` con accion de reenviar confirmacion.
3. ✅ Crear `auth/recover.html` y acceso desde login.

## Fase 4 — Validacion y cierre
1. ✅ Ejecutar `node --test scripts/tests/test-auth-sync.js`.
2. ✅ Ejecutar `./scripts/build-hub.sh --mode strict` y `./scripts/smoke-hub-runtime.sh`.
3. ✅ Actualizar tracking (`MASTER-TRACKER`, `HUB-STABILITY-LOG`, `SESSION-HANDOFF`) y cerrar GitFlow + deploy Vercel.
