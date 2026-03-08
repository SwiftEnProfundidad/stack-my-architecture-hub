# SESSION HANDOFF

Fecha de corte: 2026-03-09

## Leyenda
- ✅ Hecho
- 🚧 En construccion (maximo 1)
- ⏳ Pendiente
- ⛔ Bloqueado

## Contexto de arranque
Workspace unificado en:
`/Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture`

Repos incluidos:
1. `stack-my-architecture-hub`
2. `stack-my-architecture-SDD`
3. `stack-my-architecture-ios`
4. `stack-my-architecture-android`

## Estado actual del producto
- Hub operativo en Vercel con rutas públicas en verde.
- Cursos publicados y sincronizados desde sus repos fuente.
- Sync cloud de progreso validado por cuenta autenticada.
- Runtime mobile-first y responsive estabilizado.
- Suites locales de smoke y closeout en verde.

## Estado actual de documentación
- La fuente de verdad transversal queda reducida a:
  - `docs/STACK-ARCHITECTURE-MASTER-TRACKER.md`
  - `docs/HUB-STABILITY-LOG.md`
  - `docs/SESSION-HANDOFF.md`
  - `docs/DECISIONS-ADR-LITE.md`
- Los artefactos de seguimiento cerrados, auditorías puntuales y planes ya ejecutados deben eliminarse o quedar fuera de versión si no gobiernan el sistema hoy.

## Último bloque cerrado
- ✅ Limpieza enterprise de artefactos de seguimiento cerrados en Hub, iOS, Android y SDD.

## Bloque en curso
- ⛔ Entitlements + Dashboard del estudiante v1.
- Fuente activa de ese bloque: `docs/PLAN-ENTITLEMENTS-DASHBOARD-20260308.md`.
- ⛔ Modo entrevista tecnica v1.
- Fuente activa del bloque nuevo: `docs/PLAN-MODO-ENTREVISTA-TECNICA-20260309.md`.

## Progreso real del bloque en curso
1. Fase 0 cerrada: esquema Supabase, contratos API y seeds teaser iniciales.
2. Fase 1 cerrada: Hub y cursos resuelven acceso `full / teaser / blocked` con bypass local acotado.
3. Fase 2 cerrada: el Hub ya muestra progreso por curso, etapa, checkpoints, progreso de ruta y siguiente paso con quick actions operativas.
4. Se corrigió la compatibilidad entre los `course-id` publicados (`stack-my-architecture-ios/android/sdd`) y la normalización backend del Hub, de modo que dashboard, progreso, notas, bookmarks y access gate hablen el mismo idioma.
5. La semántica de `trial` ya está corregida a `teaser-only`, sin acceso completo implícito.
6. Panel admin ya cubre usuarios, roles, entitlements, teasers y auditoría mínima; sigue protegido por login admin.
7. QA local cerrada:
   - `anonymous`, `trial`, `student` y `admin` validados con Playwright en host público local `sslip.io`
   - sync cross-device validado para el caso de negocio real: dispositivo A guarda, dispositivo B abre después y recupera `completado`, `repaso`, `bookmark` y `nota`
   - dashboard y panel admin validados en `390x844`; corregido overflow horizontal del panel admin
8. Queda abierta solo la Fase 4.4: redeploy final cuando Vercel deje publicar.
9. Existe una discrepancia de entorno en Vercel/local pulled: la `SUPABASE_SERVICE_ROLE_KEY` actual no opera bien sobre tablas `hub_*`; con clave corregida local el bloque funciona.

## Progreso real del bloque de modo entrevista tecnica
1. Packs curados para `iOS`, `Android` y `SDD` reutilizando contenido ya publicado de defensa técnica, empleabilidad y proyecto final.
2. Punto de entrada listo en Hub:
   - dashboard autenticado
   - catálogo con quick action visible cuando existe acceso válido
3. Runtime operativo en los tres cursos:
   - botón `Entrevista` en topbar
   - autoapertura por `?mode=interview`
   - panel con pregunta guía, rúbrica y lecciones fuente
4. QA local cerrada:
   - `iOS` validado en escritorio y móvil con Playwright
   - `Android` validado en escritorio; se observan errores Mermaid legacy ya existentes fuera del alcance de este bloque
   - `SDD` validado en escritorio con panel y enlaces fuente operativos
5. Build Hub `strict` en verde tras sincronizar los runtimes modificados.
6. GitFlow del bloque de modo entrevista ya está cerrado: PRs mergeadas en Hub/iOS/Android/SDD y `develop` limpio en los cuatro repos.
7. El redeploy final no pudo ejecutarse por cuota diaria de Vercel (`api-deployments-free-per-day`).

## Siguiente paso operativo
1. Reintentar despliegue del Hub cuando Vercel libere cuota diaria.
2. Ejecutar `post-deploy-checks` para cerrar publicación pendiente de `Entitlements + Dashboard` y `Modo entrevista tecnica v1`.
3. Abrir el siguiente bloque de producto solo después de ese redeploy.

## Resultado del bloque anterior
1. Builders y validadores dejan de depender de `TODO`, `DECISIONES-TOMADAS` o auditorías cerradas.
2. Los cursos solo publican documentación estable del alumno.
3. Los repos quedan sin residuos de seguimiento ya amortizados.
4. El Hub vuelve a compilar y sincronizar en verde.

## Comandos útiles
1. Build Hub estricto:
`cd "/Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture/stack-my-architecture-hub" && ./scripts/build-hub.sh --mode strict`
2. Rebuild iOS:
`cd "/Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture/stack-my-architecture-ios" && python3 scripts/build-html.py`
3. Rebuild Android:
`cd "/Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture/stack-my-architecture-android" && python3 scripts/build-html.py`
4. Rebuild SDD:
`cd "/Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture/stack-my-architecture-SDD/stack-my-architecture-SDD" && python3 scripts/build-html.py`

## Nota operativa
El usuario ha pedido continuar en automático. Mientras Vercel siga bloqueado por cuota, el trabajo activo pasa a `Modo entrevista tecnica v1`; el bloque de entitlements solo queda pendiente de redeploy final.
