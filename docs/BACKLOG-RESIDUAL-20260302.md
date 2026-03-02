# BACKLOG RESIDUAL PRIORIZADO (2026-03-02)

## Leyenda
- `P1` Critico
- `P2` Alto
- `P3` Medio
- `P4` Bajo
- `⛔` Bloqueado externo
- `⏳` Pendiente
- `✅` Cerrado

## Contexto
Documento operativo de cierre para la fase `5.4` del plan activo:
- Plan fuente: `docs/PLAN-AUDITORIA-CURSOS-FASES-20260302.md`
- Estado actual del plan:
  - `5.3` -> `⛔` (cuota Vercel)
  - `5.4` -> `🚧` (cierre final + backlog residual)

## Items priorizados
1. `P1` `⛔` Ejecutar despliegue productivo final en Vercel (`5.3`).
   - Bloqueo: `api-deployments-free-per-day`.
   - Comando validado:
     - `bash scripts/publish-architecture-stack.sh fast`
   - Intentos registrados:
     - `2026-03-02 23:24 CET` -> bloqueado (`try again in 17 hours`).
     - `2026-03-02 23:37 CET` -> bloqueado (`try again in 17 hours`).
     - `2026-03-02 23:49 CET` -> bloqueado (`try again in 16 hours`).
   - Próxima ventana estimada de reintento:
     - `2026-03-03 15:49 CET` o posterior.
   - Criterio de cierre:
     - deploy productivo completado sin error de cuota.

2. `P1` `⏳` Verificar rutas públicas post-deploy.
   - Rutas:
     - `https://architecture-stack.vercel.app/`
     - `https://architecture-stack.vercel.app/ios/`
     - `https://architecture-stack.vercel.app/android/`
     - `https://architecture-stack.vercel.app/sdd/`
   - Automatización disponible:
     - `scripts/smoke-public-routes.sh [base_url]`
   - Evidencia pre-deploy (baseline):
     - `2026-03-02 23:39 CET` -> `200` en las 4 rutas con `./scripts/smoke-public-routes.sh`
   - Criterio de cierre:
     - HTTP `200` en las 4 rutas.

3. `P2` `⏳` Ejecutar smoke funcional mínimo post-deploy.
   - Alcance:
     - apertura de cada curso desde el Hub.
     - navegación de una lección por curso.
     - validación de estado login/logout en runtime.
   - Automatización disponible:
     - `scripts/smoke-public-functional.sh [base_url]`
   - Evidencia pre-deploy (baseline):
     - `2026-03-02 23:41 CET` -> smoke funcional público en verde para Hub/Auth/iOS/Android/SDD.
   - Criterio de cierre:
     - sin regresiones de arranque ni navegación.

5. `P2` `⏳` Runner unificado post-deploy.
   - Script:
     - `scripts/post-deploy-checks.sh [base_url]`
   - Baseline pre-deploy:
     - `2026-03-02 23:43 CET` -> runner completo en verde.
   - Criterio de cierre:
     - ejecución en verde inmediatamente después del deploy final de `5.3`.

6. `P2` `⏳` Runner end-to-end de cierre.
   - Script:
     - `scripts/deploy-and-verify-closeout.sh [fast|strict] [base_url]`
   - Última ejecución:
     - `2026-03-02 23:49 CET` -> build OK, deploy bloqueado por cuota (`api-deployments-free-per-day`).
   - Criterio de cierre:
     - deploy productivo + `post-deploy-checks` en una sola ejecución verde.

4. `P3` `⏳` Cerrar `5.4` y congelar handoff final.
   - Alcance:
     - `PLAN`, `SESSION-HANDOFF`, `MASTER-TRACKER`, `HUB-STABILITY-LOG`, `ADR-LITE`.
   - Criterio de cierre:
     - sin tareas `🚧` abiertas.
     - backlog residual en `✅` o `⛔` documentado con fecha.

## Notas de operación
1. No ejecutar nuevos despliegues de prueba antes de reset de cuota.
2. Mantener commits atómicos y GitFlow end-to-end por cada cierre de item.
3. Si reaparece el bloqueo de cuota, registrar timestamp exacto y ventana de retry.
