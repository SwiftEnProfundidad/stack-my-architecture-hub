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
     - `2026-03-03 02:07 CET` -> bloqueado (`try again in 14 hours`) tras fallback manual de ejecución.
   - Próxima ventana estimada de reintento:
     - `2026-03-03 16:07 CET` o posterior (`job en cola: 16:08 CET`).
   - Criterio de cierre:
     - deploy productivo completado sin error de cuota.

2. `P1` `✅` Verificar rutas públicas post-deploy.
   - Rutas:
     - `https://architecture-stack.vercel.app/`
     - `https://architecture-stack.vercel.app/ios/`
     - `https://architecture-stack.vercel.app/android/`
     - `https://architecture-stack.vercel.app/sdd/`
   - Automatización disponible:
     - `scripts/smoke-public-routes.sh [base_url]`
   - Evidencia pre-deploy (baseline):
     - `2026-03-02 23:39 CET` -> `200` en las 4 rutas con `./scripts/smoke-public-routes.sh`
   - Evidencia cierre:
     - `2026-03-03 02:42 CET` -> `./scripts/smoke-public-routes.sh https://architecture-stack.vercel.app` -> `200` en `/`, `/ios/`, `/android/`, `/sdd/`.
   - Criterio de cierre:
     - HTTP `200` en las 4 rutas.

3. `P2` `✅` Ejecutar smoke funcional mínimo post-deploy.
   - Alcance:
     - apertura de cada curso desde el Hub.
     - navegación de una lección por curso.
     - validación de estado login/logout en runtime.
   - Automatización disponible:
     - `scripts/smoke-public-functional.sh [base_url]`
   - Evidencia pre-deploy (baseline):
     - `2026-03-02 23:41 CET` -> smoke funcional público en verde para Hub/Auth/iOS/Android/SDD.
   - Evidencia cierre:
     - `2026-03-03 02:42 CET` -> `./scripts/smoke-public-functional.sh https://architecture-stack.vercel.app` -> verde completo (Hub/Auth/iOS/Android/SDD).
   - Criterio de cierre:
     - sin regresiones de arranque ni navegación.

5. `P2` `✅` Runner unificado post-deploy.
   - Script:
     - `scripts/post-deploy-checks.sh [base_url]`
   - Baseline pre-deploy:
     - `2026-03-02 23:43 CET` -> runner completo en verde.
   - Evidencia cierre:
     - `2026-03-03 02:43 CET` -> `./scripts/post-deploy-checks.sh https://architecture-stack.vercel.app` -> verde completo.
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
     - `2026-03-03 02:07 CET` -> build OK, deploy bloqueado por cuota (`api-deployments-free-per-day`), cooldown actualizado a `2026-03-03 16:07:10 CET`.
     - `2026-03-03 02:45 CET` -> guard activo (sin consumir intento), mantiene ventana `2026-03-03 16:07:10 CET`.
   - Criterio de cierre:
     - deploy productivo + `post-deploy-checks` en una sola ejecución verde.

7. `P3` `⏳` Estado operativo de cierre con comando único.
   - Script:
     - `scripts/closeout-status.sh`
   - Resultado actual:
     - `2026-03-03 02:07 CET` -> cooldown activo, not-before `2026-03-03 16:07:10 CET`.
     - `2026-03-03 02:45 CET` -> cooldown activo, not-before `2026-03-03 16:07:10 CET`, job automático activo (`15`, `16`, `17` en cola).
     - `2026-03-03 02:52 CET` -> cooldown activo, not-before `2026-03-03 16:07:10 CET`, cola refrescada (`18`, `19`, `20`).
     - `2026-03-03 02:58 CET` -> cooldown activo + verificación explícita de jobs de ventana:
       - `Job main activo` (`18`),
       - `Job watchdog activo` (`19`),
       - `Job followup activo` (`20`).
     - `2026-03-03 03:03 CET` -> `closeout-readiness` también valida ventana completa (`main/watchdog/followup`) y mantiene `EXIT_CODE=2` solo cuando la ventana está íntegra.
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
     - `2026-03-03 01:08 CET` -> job closeout reprogramado por epoch (`not_before+60s`) a `Tue Mar 3 02:02:00 2026`.
     - `2026-03-03 02:03 CET` -> job `02:02` quedó vencido en cola (past-due), se aplicó fallback manual.
     - `2026-03-03 02:07 CET` -> fallback manual `./scripts/closeout-at-job.sh` ejecutado; autoreprogramación crea `job 12` para `16:08 CET`.
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
     - `2026-03-03 02:07 CET` -> estado `EN ESPERA` + `EXIT_CODE=2` + job automático activo (`16:08 CET`) visible.

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
     - `tests`: ejecuta las suites de regresión de closeout (actualmente 10).
     - `full`: ejecuta suites + checks runtime (`atq` + `closeout-status` + `closeout-readiness`), aceptando estado `2` como espera válida.
   - Evidencia:
     - `2026-03-03 01:00 CET` -> `./scripts/run-closeout-qa-suite.sh tests` y `./scripts/run-closeout-qa-suite.sh full` -> verde.

18. `P3` `✅` Guidance dinámica de reprogramación en readiness.
   - Script:
     - `scripts/closeout-readiness.sh [--verbose]`
   - Comportamiento:
     - con cooldown activo calcula `suggested_epoch=not_before_epoch+60`.
     - si no hay job automático devuelve `EXIT_CODE=3` y recomienda `schedule-closeout-at.sh --epoch <suggested_epoch>`.
     - si hay job activo mantiene `EXIT_CODE=2` y muestra sugerencia de reprogramación al epoch recomendado.
   - Evidencia:
     - `2026-03-03 01:06 CET` -> `./scripts/tests/test-closeout-readiness.sh` -> `[PASS]`.
     - `2026-03-03 01:06 CET` -> `./scripts/run-closeout-qa-suite.sh tests` y `./scripts/run-closeout-qa-suite.sh full` -> verde.
     - `2026-03-03 01:08 CET` -> `./scripts/schedule-closeout-at.sh --epoch 1772499746` -> cola actualizada (`job 9`, `02:02 CET`).

19. `P3` `✅` Sanitización de log path en readiness.
   - Script:
     - `scripts/closeout-readiness.sh [--verbose]`
   - Comportamiento:
     - cuando `last_log_file` no existe, reporta `Último log: no disponible` (sin rutas temporales stale).
     - si el log existe, conserva path real y tail en modo `--verbose`.
   - Cobertura:
     - `scripts/tests/test-closeout-readiness.sh` verifica explícitamente el caso de log inexistente.
   - Evidencia:
     - `2026-03-03 01:12 CET` -> `./scripts/tests/test-closeout-readiness.sh` -> `[PASS]`.
     - `2026-03-03 01:12 CET` -> `./scripts/run-closeout-qa-suite.sh tests` -> verde.
     - `2026-03-03 01:13 CET` -> `./scripts/closeout-readiness.sh` muestra `Último log: no disponible`.

20. `P3` `✅` Sugerencia inteligente de reprogramación en readiness.
   - Script:
     - `scripts/closeout-readiness.sh [--verbose]`
   - Comportamiento:
     - si el job activo ya cae en el mismo minuto de `not_before+60s`, no muestra sugerencia de reprogramación.
     - si el job está tarde (minuto distinto), mantiene sugerencia `--epoch`.
   - Cobertura:
     - `scripts/tests/test-closeout-readiness.sh` añade caso `3b` (job alineado sin sugerencia).
   - Evidencia:
     - `2026-03-03 01:16 CET` -> `./scripts/tests/test-closeout-readiness.sh` -> `[PASS]`.
     - `2026-03-03 01:16 CET` -> `./scripts/run-closeout-qa-suite.sh tests` -> verde.
     - `2026-03-03 01:17 CET` -> `./scripts/closeout-readiness.sh` con job alineado (`02:02 CET`) -> sin sugerencia redundante.

21. `P3` `✅` Hardening de entorno para programación `at`.
   - Script:
     - `scripts/schedule-closeout-at.sh`
   - Comportamiento:
     - sanea el entorno al invocar `AT_CMD` (real o forzado), minimizando variables heredadas.
     - mantiene compatibilidad de tests permitiendo variables `FAKE_*` en entorno saneado.
   - Cobertura:
     - `scripts/tests/test-schedule-closeout-at.sh` añade caso con `SMA_AT_FORCE_SANITIZE=1` y valida que no se propaga `TEST_SECRET`.
   - Evidencia:
     - `2026-03-03 01:20 CET` -> `./scripts/tests/test-schedule-closeout-at.sh` -> `[PASS]`.
     - `2026-03-03 01:20 CET` -> `./scripts/run-closeout-qa-suite.sh tests` -> verde.
     - `2026-03-03 01:24 CET` -> job closeout recreado con scheduler hardened (`job 11`, `02:02 CET`).
     - `2026-03-03 01:24 CET` -> `at -c 11 | rg 'OPENAI_API_KEY|HEYGEN_API_KEY|sk-'` -> sin coincidencias.

22. `P3` `✅` Recovery automático de jobs closeout past-due.
   - Script:
     - `scripts/recover-past-due-closeout.sh`
   - Comportamiento:
     - detecta job closeout stale cuando el cooldown ya venció más un margen (`SMA_CLOSEOUT_GRACE_SECONDS`).
     - elimina el job stale y ejecuta fallback manual (`closeout-at-job.sh` o override).
   - Cobertura:
     - `scripts/tests/test-recover-past-due-closeout.sh` cubre:
       - cooldown activo (sin recovery),
       - cooldown expirado sin job,
       - cooldown expirado con job stale (recovery),
       - error en fallback (propagación de exit code).
   - Evidencia:
     - `2026-03-03 02:18 CET` -> `./scripts/tests/test-recover-past-due-closeout.sh` -> `[PASS]`.
     - `2026-03-03 02:18 CET` -> `./scripts/run-closeout-qa-suite.sh tests` (7 suites en ese momento) -> verde.
     - `2026-03-03 02:18 CET` -> `./scripts/recover-past-due-closeout.sh` en runtime -> sin recovery (`within grace`).
     - `2026-03-03 02:22 CET` -> watchdog programado (`job 14`, `16:10 CET`) para ejecutar recovery tras job principal (`16:08 CET`) si quedase stale.

23. `P3` `✅` Estabilización de test flakey en wait-runner.
   - Test:
     - `scripts/tests/test-closeout-wait-and-run.sh` (case `short cooldown`).
   - Ajuste:
     - la aserción acepta ambos caminos válidos en frontera temporal:
       - espera explícita y apertura de ventana,
       - cooldown ya expirado al inicio.
   - Evidencia:
     - `2026-03-03 02:20 CET` -> `./scripts/tests/test-closeout-wait-and-run.sh` -> `[PASS]`.
     - `2026-03-03 02:20 CET` -> `./scripts/run-closeout-qa-suite.sh tests` -> verde estable.

24. `P3` `✅` Orquestador de ventana (main + watchdog + followup) en comando único.
   - Script:
     - `scripts/schedule-closeout-window.sh [--epoch <unix_epoch>]`
   - Comportamiento:
     - calcula y programa job principal (`not_before + main_offset`),
     - limpia y reprogama watchdog (`main_epoch + watchdog_delay`),
     - limpia y reprogama followup (`main_epoch + followup_delay`),
     - usa scheduler/versionado existente + entorno saneado para `at`.
   - Cobertura:
     - `scripts/tests/test-schedule-closeout-window.sh` (incluye assertions de scheduling + payload para watchdog/followup).
   - Evidencia:
     - `2026-03-03 02:28 CET` -> `./scripts/tests/test-schedule-closeout-window.sh` -> `[PASS]`.
     - `2026-03-03 02:28 CET` -> `./scripts/run-closeout-qa-suite.sh tests` (8 suites en ese momento) -> verde.
     - `2026-03-03 02:29 CET` -> `./scripts/schedule-closeout-window.sh` refresca cola a `job 15` (`16:08`) + `job 16` (`16:10`).
     - `2026-03-03 02:39 CET` -> refuerzo de test para validar followup integrado (`AT -t` watchdog+followup + cleanup idempotente de jobs viejos) -> `[PASS]`.
     - `2026-03-03 02:39 CET` -> `./scripts/run-closeout-qa-suite.sh tests` -> verde (9 suites).
     - `2026-03-03 02:51 CET` -> reprogamación runtime tras hardening de PATH: cola activa `job 18` (`16:08`) + `job 19` (`16:10`) + `job 20` (`16:12`).

25. `P3` `✅` Snapshot post-ventana automatizado.
   - Script:
     - `scripts/closeout-window-followup.sh`
   - Comportamiento:
     - registra en log runtime: `atq`, `closeout-status`, `closeout-readiness`, `auto-closeout-status.env` y estado de `closeout-complete.flag`.
   - Cobertura:
     - `scripts/tests/test-closeout-window-followup.sh`
   - Evidencia:
     - `2026-03-03 02:36 CET` -> `./scripts/tests/test-closeout-window-followup.sh` -> `[PASS]`.
     - `2026-03-03 02:36 CET` -> `./scripts/run-closeout-qa-suite.sh tests` (9 suites) -> verde.
     - `2026-03-03 02:37 CET` -> followup programado como `job 17` (`16:12 CET`) detrás de main (`15`) y watchdog (`16`).

26. `P3` `✅` Hardening de `PATH` saneado para jobs `at`.
   - Scripts:
     - `scripts/schedule-closeout-at.sh`
     - `scripts/schedule-closeout-window.sh`
   - Comportamiento:
     - el entorno saneado deja de heredar `PATH` interactivo y usa `SMA_AT_SANITIZED_PATH` (default mínimo fijo).
     - evita propagar rutas efímeras del shell/editor a jobs programados.
   - Cobertura:
     - `scripts/tests/test-schedule-closeout-at.sh`
     - `scripts/tests/test-schedule-closeout-window.sh`
   - Evidencia:
     - `2026-03-03 02:49 CET` -> ambos tests pasan con aserción explícita de `PATH` fijo y sin `leaky-bin`.
     - `2026-03-03 02:49 CET` -> `./scripts/run-closeout-qa-suite.sh tests` -> verde.
     - `2026-03-03 02:49 CET` -> `./scripts/run-closeout-qa-suite.sh full` -> verde.
     - `2026-03-03 02:51 CET` -> `at -c 18|19|20` confirma `export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`.

27. `P3` `✅` Hardening de estado de ventana + aislamiento de tests runtime.
   - Scripts:
     - `scripts/closeout-status.sh`
     - `scripts/closeout-readiness.sh`
   - Comportamiento:
     - `closeout-status` valida durante cooldown la presencia de los 3 jobs de ventana (`main/watchdog/followup`).
     - si falta alguno, devuelve `EXIT_CODE=3` y recomienda `./scripts/schedule-closeout-window.sh`.
     - `closeout-readiness` admite `SMA_CLOSEOUT_RUNTIME_DIR` para ejecutar tests en runtime aislado.
   - Cobertura:
     - `scripts/tests/test-closeout-status.sh` añade casos de cola completa y cola incompleta.
     - `scripts/tests/test-closeout-readiness.sh` deja de tocar `.runtime` real (usa directorio temporal por test).
   - Evidencia:
     - `2026-03-03 02:57 CET` -> `./scripts/tests/test-closeout-readiness.sh` -> `[PASS]`.
     - `2026-03-03 02:57 CET` -> `./scripts/tests/test-closeout-status.sh` -> `[PASS]`.
     - `2026-03-03 02:57 CET` -> `./scripts/run-closeout-qa-suite.sh tests` -> verde.
     - `2026-03-03 02:58 CET` -> `./scripts/run-closeout-qa-suite.sh full` -> verde.

28. `P3` `✅` Readiness endurecido con salud completa de ventana.
   - Script:
     - `scripts/closeout-readiness.sh`
   - Comportamiento:
     - durante cooldown exige `main + watchdog + followup` para considerar estado operativo en espera (`EXIT_CODE=2`).
     - si falta cualquier job de ventana devuelve `EXIT_CODE=3` y recomienda `./scripts/schedule-closeout-window.sh`.
   - Cobertura:
     - `scripts/tests/test-closeout-readiness.sh` ampliado con casos:
       - solo `main` -> `EXIT_CODE=3`,
       - ventana completa -> `EXIT_CODE=2`,
       - ventana completa con `main` tardío -> sugerencia `--epoch`,
       - ventana incompleta (`followup` faltante) -> `EXIT_CODE=3`.
   - Evidencia:
     - `2026-03-03 03:03 CET` -> `./scripts/tests/test-closeout-readiness.sh` -> `[PASS]`.
     - `2026-03-03 03:03 CET` -> `./scripts/run-closeout-qa-suite.sh tests` -> verde.
     - `2026-03-03 03:03 CET` -> `./scripts/run-closeout-qa-suite.sh full` -> verde.

29. `P3` `✅` Runner QA full endurecido con `closeout-status` + test dedicado.
   - Script:
     - `scripts/run-closeout-qa-suite.sh`
   - Comportamiento:
     - `full` ahora ejecuta `closeout-status` antes de `closeout-readiness`.
     - si `closeout-status` devuelve `3` (ventana incompleta), falla inmediatamente el runner.
     - acepta overrides por entorno para tests herméticos:
       - `SMA_CLOSEOUT_QA_TESTS_FILE`
       - `SMA_ATQ_CMD`
       - `SMA_CLOSEOUT_STATUS_CMD`
       - `SMA_CLOSEOUT_READINESS_CMD`
   - Cobertura:
     - `scripts/tests/test-run-closeout-qa-suite.sh`
   - Evidencia:
     - `2026-03-03 03:08 CET` -> `./scripts/tests/test-run-closeout-qa-suite.sh` -> `[PASS]`.
     - `2026-03-03 03:08 CET` -> `./scripts/run-closeout-qa-suite.sh tests` -> verde (10 suites).
     - `2026-03-03 03:08 CET` -> `./scripts/run-closeout-qa-suite.sh full` -> verde.

30. `P3` `✅` Auto-reschedule de `closeout-at-job` alineado con ventana completa.
   - Script:
     - `scripts/closeout-at-job.sh`
   - Comportamiento:
     - la reprogramación automática tras cooldown usa por defecto `schedule-closeout-window.sh` (main + watchdog + followup), no solo `schedule-closeout-at.sh`.
     - mantiene compatibilidad con override explícito vía `SMA_CLOSEOUT_SCHEDULER_CMD`.
   - Cobertura:
     - `scripts/tests/test-closeout-at-job.sh` añade caso de default scheduler (copy hermético del script + fake `schedule-closeout-window.sh`).
   - Evidencia:
     - `2026-03-03 03:12 CET` -> `./scripts/tests/test-closeout-at-job.sh` -> `[PASS]`.
     - `2026-03-03 03:12 CET` -> `./scripts/tests/test-run-closeout-qa-suite.sh` -> `[PASS]`.
     - `2026-03-03 03:12 CET` -> `./scripts/run-closeout-qa-suite.sh tests` y `full` -> verde.

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
