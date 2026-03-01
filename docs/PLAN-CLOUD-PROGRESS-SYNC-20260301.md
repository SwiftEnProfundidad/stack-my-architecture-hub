# PLAN CLOUD PROGRESS SYNC — 2026-03-01

## Leyenda
- ✅ Hecho
- 🚧 En construccion (maximo 1)
- ⏳ Pendiente
- ⛔ Bloqueado

## Objetivo
Persistir progreso y repaso de cursos en backend para que no dependa solo de `localStorage` del origen Vercel.

## Fase 0 — Descubrimiento y contrato
1. ✅ Auditar persistencia actual en `study-ux.js` (iOS/Android/SDD).
2. ✅ Definir contrato de sync cloud (`/progress/config`, `/progress/state`).
3. ✅ Definir estrategia de compatibilidad: local inmediato + sync cloud en background.

## Fase 1 — Backend (Hub API)
1. ✅ RED: tests de contrato para endpoint `progress-sync`.
2. ✅ GREEN: implementar `api/progress-sync.js` con validación de payload y upsert en Supabase REST.
3. ✅ GREEN: exponer rutas públicas con rewrite Vercel (`/progress/config`, `/progress/state`).
4. ✅ REFACTOR: endurecer sanitización/tamaño y normalización de estado.

## Fase 2 — Frontend (cursos)
1. ✅ Integrar sync cloud en `assets/study-ux.js` de iOS.
2. ✅ Replicar integración en Android y SDD.
3. ✅ Mantener fallback seguro: si cloud no está configurado, UX sigue operando con `localStorage`.
4. ✅ Sincronizar eventos críticos (`completed`, `review`, `lastTopic`, `stats`, `zen`, `fontSize`).
5. ✅ Soportar reset/import con push forzado para evitar rollback desde cloud.

## Fase 3 — Integración y publicación
1. ✅ Rebuild de cursos fuente (`build-html` iOS/Android/SDD).
2. ✅ Validación Hub (`build-hub --mode strict`, drift `no drift (6/6)`, smoke runtime OK).
3. ✅ Cierre GitFlow completo + despliegue Vercel.
4. ✅ Documentar configuración operativa (SQL + variables de entorno).
