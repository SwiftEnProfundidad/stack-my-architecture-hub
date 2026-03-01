# PLAN LOTES ATOMICOS

Fecha: 2026-02-27
Relacion: Task 0.3 del plan maestro

## Lote A - Baseline
1. Inventario exacto cross-course (TSV + resumen MD).
2. Matriz de brechas P0/P1/P2 (TSV + resumen MD).
3. Actualizacion de estado inicial en tracker/handoff.

## Lote B - iOS
1. Correccion de gaps P0/P1 en lecciones iOS con bloque por capas y snippet Swift.
2. Build y validaciones iOS en verde.
3. PR iOS y merge a `develop`.

## Lote C - Android
1. Correccion de gaps P0/P1 en lecciones Android con bloque por capas y snippet Kotlin.
2. Build y validaciones Android en verde.
3. PR Android y merge a `develop`.

## Lote D - SDD
1. Checklist AGENTS completo en verde.
2. Cierre de auditoria SDD en documento dedicado.
3. Ajuste puntual para pasar validador pedagogico en informe de auditoria.
4. PRs SDD y merge a `develop`.

## Lote E - Hub final
1. `build-hub --mode strict` en verde.
2. `check-selective-sync-drift` en `no drift (6/6)`.
3. `smoke-hub-runtime` en verde.
4. Actualizacion final de tracking.

## Lote F - Publicacion
1. Intento de despliegue final Vercel.
2. Estado bloqueado por cuota diaria de deployments free.
