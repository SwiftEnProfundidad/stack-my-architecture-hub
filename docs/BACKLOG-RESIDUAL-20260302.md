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
   - Guard de cuota integrado:
     - usa `.runtime/vercel-deploy-cooldown.env`
     - bloquea intentos antes de `not_before_epoch` (salida controlada `EXIT_CODE=2`)
     - permite forzar con `SMA_DEPLOY_FORCE=1`
   - Última ejecución:
     - `2026-03-02 23:49 CET` -> build OK, deploy bloqueado por cuota (`api-deployments-free-per-day`).
     - `2026-03-02 23:53 CET` -> guard activo (sin consumir intento), ventana vigente `2026-03-03 15:49:00 CET`.
   - Criterio de cierre:
     - deploy productivo + `post-deploy-checks` en una sola ejecución verde.

7. `P3` `⏳` Estado operativo de cierre con comando único.
   - Script:
     - `scripts/closeout-status.sh`
   - Resultado actual:
     - `2026-03-02 23:56 CET` -> cooldown activo, not-before `2026-03-03 15:49:00 CET`.
   - Criterio de cierre:
     - reportar estado `listo para reintento de deploy` en ventana válida.

8. `P3` `✅` Runner de espera automática para ventana de cuota.
   - Script:
     - `scripts/closeout-wait-and-run.sh [fast|strict] [base_url]`
   - Comportamiento:
     - espera hasta `not_before` cuando hay cooldown.
     - ejecuta `deploy-and-verify-closeout.sh` al abrir ventana.
     - sale sin intento cuando la espera supera `SMA_CLOSEOUT_MAX_WAIT_SECONDS`.
   - Evidencia:
     - `2026-03-03 00:01 CET` -> `SMA_CLOSEOUT_MAX_WAIT_SECONDS=60 ./scripts/closeout-wait-and-run.sh fast` sale controlado con cooldown activo (sin consumir intento).
   - Criterio de cierre:
     - automatización lista para ejecución desatendida durante `5.4`.

9. `P3` `✅` Orquestación programada de reintento en ventana.
   - Programación:
     - `at 15:50` del `2026-03-03`, posterior al `not-before` (`15:49 CET`).
   - Job:
     - `scripts/closeout-at-job.sh` (versionado) -> ejecuta `closeout-wait-and-run.sh fast`.
     - reprogramación controlada con `scripts/schedule-closeout-at.sh [hora]` o `scripts/schedule-closeout-at.sh --epoch <unix>`.
     - autoreintento: si `closeout-wait-and-run.sh` devuelve cooldown (`exit != 0`) y existe `vercel-deploy-cooldown.env`, reprograma automáticamente siguiente intento (`not_before + 60s` por defecto).
     - estado persistente: `.runtime/auto-closeout-status.env` + flag `.runtime/closeout-complete.flag` en éxito.
   - Log esperado:
     - `.runtime/auto-closeout-YYYYMMDDTHHMMSS.log`.
   - Evidencia:
     - `atq` muestra job activo en `Tue Mar 3 15:50:00 2026`.
     - `at -c <job_id_activo>` referencia `scripts/closeout-at-job.sh`.
   - Criterio de cierre:
     - garantizar intento automático en primera ventana útil sin intervención manual.

10. `P3` `✅` Comando único de preparación de cierre (`ready/no-ready`).
   - Script:
     - `scripts/closeout-readiness.sh [--verbose]`
   - Comportamiento:
     - `EXIT_CODE=0`: cierre listo (flag de éxito presente).
     - `EXIT_CODE=2`: en espera por cooldown con ventana restante.
     - `EXIT_CODE=3`: cooldown activo pero sin job `at` de closeout en cola (acción requerida).
      - `EXIT_CODE=1`: requiere revisión manual.
   - Evidencia:
     - `2026-03-03 00:33 CET` -> estado `EN ESPERA` + `EXIT_CODE=2` + job automático activo (`15:50 CET`) visible.

11. `P3` `✅` Tests de regresión para readiness de cierre.
   - Test:
     - `scripts/tests/test-closeout-readiness.sh`
   - Cobertura:
     - sin ejecución registrada -> `EXIT_CODE=1`,
     - cooldown sin job -> `EXIT_CODE=3`,
     - cooldown con job -> `EXIT_CODE=2`,
     - cierre completo -> `EXIT_CODE=0`.
   - Evidencia:
     - `2026-03-03 00:40 CET` -> `./scripts/tests/test-closeout-readiness.sh` -> `[PASS]`.

12. `P3` `✅` Tests de regresión para scheduler `at`.
   - Test:
     - `scripts/tests/test-schedule-closeout-at.sh`
   - Cobertura:
     - programa por hora textual,
     - limpia solo jobs de closeout previos (sin tocar jobs no relacionados),
     - programa por epoch (`--epoch`) usando `at -t`,
     - valida error de epoch inválido.
   - Evidencia:
     - `2026-03-03 00:44 CET` -> `./scripts/tests/test-schedule-closeout-at.sh` -> `[PASS]`.

13. `P3` `✅` Tests de regresión para `closeout-at-job`.
   - Test:
     - `scripts/tests/test-closeout-at-job.sh`
   - Cobertura:
     - éxito (`exit 0`) con creación de `closeout-complete.flag`,
     - fallo con `auto_reschedule=1` y programación `--epoch` esperada,
     - fallo con `auto_reschedule=0` sin reprogamación.
   - Evidencia:
     - `2026-03-03 00:48 CET` -> `./scripts/tests/test-closeout-at-job.sh` -> `[PASS]`.

14. `P3` `✅` Tests de regresión para `closeout-wait-and-run`.
   - Test:
     - `scripts/tests/test-closeout-wait-and-run.sh`
   - Cobertura:
     - sin cooldown -> ejecuta deploy inmediato,
     - cooldown largo con `MAX_WAIT` bajo -> `EXIT_CODE=2`,
     - `SMA_DEPLOY_FORCE=1` -> bypass de cooldown,
     - cooldown corto -> espera y ejecuta deploy.
   - Evidencia:
     - `2026-03-03 00:53 CET` -> `./scripts/tests/test-closeout-wait-and-run.sh` -> `[PASS]`.

15. `P3` `✅` Tests de regresión para `deploy-and-verify-closeout`.
   - Test:
     - `scripts/tests/test-deploy-and-verify-closeout.sh`
   - Cobertura:
     - guard de cooldown activo (`EXIT_CODE=2`),
     - bypass con `SMA_DEPLOY_FORCE=1`,
     - flujo exitoso (deploy + post-checks),
     - error de cuota (`EXIT_CODE=3` + escritura de cooldown),
     - error genérico de publish (propagación de exit code).
   - Evidencia:
     - `2026-03-03 00:56 CET` -> `./scripts/tests/test-deploy-and-verify-closeout.sh` -> `[PASS]`.

16. `P3` `✅` Tests de regresión para `closeout-status`.
   - Test:
     - `scripts/tests/test-closeout-status.sh`
   - Cobertura:
     - sin cooldown (`EXIT_CODE=0`),
     - cooldown activo (`EXIT_CODE=2`),
     - cooldown expirado (`EXIT_CODE=0`).
   - Evidencia:
     - `2026-03-03 00:56 CET` -> `./scripts/tests/test-closeout-status.sh` -> `[PASS]`.

17. `P3` `✅` Runner único de QA de cierre.
   - Script:
     - `scripts/run-closeout-qa-suite.sh [full|tests]`
   - Comportamiento:
     - `tests`: ejecuta las 6 suites de regresión de closeout.
     - `full`: ejecuta suites + checks runtime (`atq` + `closeout-readiness`), aceptando `readiness=2` como estado válido de espera.
   - Evidencia:
     - `2026-03-03 01:00 CET` -> `./scripts/run-closeout-qa-suite.sh tests` y `./scripts/run-closeout-qa-suite.sh full` -> verde.

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
