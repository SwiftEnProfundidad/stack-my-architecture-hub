# HUB STABILITY LOG

Fecha base: 2026-02-24

## Incidencia
### Síntoma
La app abría en `127.0.0.1:46100/index.html` y devolvía `Cannot GET /index.html`.

### Diagnóstico
1. Había instancia stale respondiendo `/health` pero no sirviendo el frontend publicado.
2. El check de salud era demasiado permisivo y aceptaba proceso no válido para serving real.

## Corrección aplicada
Archivo principal:
- `stack-my-architecture-hub/scripts/launch-hub.sh`

Mejoras clave:
1. `health_ok()` valida payload de `/health`:
   - `"ok":true`
   - `"service":"assistant-bridge"`
2. `health_ok()` valida también `GET /index.html`.
3. Resolución robusta de `node`/`npm` para entornos Desktop App sin PATH completo.
4. Fallback robusto para apertura de navegador (Chrome, Safari, Comet, default, osascript).
5. Arranque tolerante sin `OPENAI_API_KEY` (hub operativo sin chat IA).

## Verificación funcional realizada
1. `GET /index.html` -> OK
2. `GET /ios/index.html` -> OK
3. `GET /android/index.html` -> OK
4. `GET /sdd/index.html` -> OK

## Evidencia de cierre
1. Commit: `1940c7d`
2. Tag: `hub-stable-20260224`
3. Estado: Estable

## Regresión post-sync de cursos
### Fecha
2026-02-24

### Contexto
Se sincronizaron los bundles publicados de `ios`, `android` y `sdd` en el Hub para reflejar el estado actual de los repos fuente.

### Evidencia versionada
1. Commit: `b4399a7`
2. Scope: `ios/*.html`, `android/*.html`, `sdd/*.html`

### Verificación funcional
1. `./scripts/smoke-hub-runtime.sh` -> OK (runtime smoke en puerto temporal).
2. Validación manual de rutas en runtime local activo:
   - `GET /index.html` -> 200
   - `GET /ios/index.html` -> 200
   - `GET /android/index.html` -> 200
   - `GET /sdd/index.html` -> 200

### Resultado
Hub mantiene estabilidad operativa y apertura de cursos tras el sync.

## Regresión post-merge SDD week06
### Fecha
2026-02-24

### Contexto
Se integró en `stack-my-architecture-SDD/main` el bloque week06 de sincronización parcial offline (`76d5764`) y se sincronizó solo el bundle publicado de SDD en Hub para evitar arrastre de WIP en iOS/Android.

### Evidencia versionada
1. SDD merge: `76d5764` (`merge(week06): integrate offline partial sync tdd cycle`)
2. Hub sync SDD: `017b3dc` (`chore(hub): sync sdd bundle after week06 tdd cycle`)
3. Scope Hub: `sdd/*.html`

### Verificación funcional
1. `./scripts/smoke-hub-runtime.sh` -> OK (runtime smoke en puerto temporal).
2. Validación de rutas de cursos dentro de smoke:
   - `/index.html` -> OK
   - `/ios/index.html` -> OK
   - `/android/index.html` -> OK
   - `/sdd/index.html` -> OK

### Resultado
El Hub conserva estabilidad y apertura de cursos tras integrar el cambio de SDD.

## Resync final por normalización de tracking SDD
### Fecha
2026-02-24

### Contexto
Tras cerrar el ticket en `main` de SDD, se normalizó el estado de tracking (`branch: main`) para reflejar estado real (`34fb52a`). Se aplicó un resync final del bundle SDD en Hub.

### Evidencia versionada
1. SDD tracking real en main: `34fb52a`
2. Hub resync SDD: `d8d286e`

### Verificación funcional
1. `./scripts/smoke-hub-runtime.sh` -> OK.
2. Rutas de cursos verificadas dentro de smoke -> OK.

### Resultado
Hub permanece estable tras la normalización final de tracking y publicación SDD.

## Regresión post-sync selectivo iOS Fase 6
### Fecha
2026-02-24

### Contexto
Tras cerrar en iOS la Fase 6 de QA (pipeline de enlaces/anchors + revisión visual trimestral), se sincronizó únicamente el bundle publicado de iOS en Hub para evitar arrastre de WIP en Android/SDD.

### Evidencia versionada
1. iOS cierre Fase 6:
   - `0291000` (`chore(qa): automate links-anchor validation in dist pipeline`)
   - `c2f3e40` (`chore(qa): close quarterly visual mermaid-assets review`)
2. Hub sync selectivo iOS: `bcba91d` (`chore(hub): sync ios bundle after phase6 qa closure`)
3. Scope Hub: `ios/*.html`

### Verificación funcional
1. `./scripts/smoke-hub-runtime.sh` -> OK (puerto temporal `46210`).
2. Rutas verificadas dentro del smoke:
   - `/index.html` -> OK
   - `/ios/index.html` -> OK
   - `/android/index.html` -> OK
   - `/sdd/index.html` -> OK

### Resultado
Hub mantiene estabilidad operativa tras publicar selectivamente iOS.

## Regresión post-sync selectivo Android + SDD
### Fecha
2026-02-24

### Contexto
Se validaron los cambios pendientes de `android/*.html` y `sdd/*.html` en Hub contra sus repos fuente y se publicaron de forma selectiva.

### Evidencia versionada
1. Hub sync selectivo Android + SDD: `dac88cc` (`chore(hub): sync android and sdd bundles`)
2. Scope Hub:
   - `android/curso-stack-my-architecture-android.html`
   - `android/index.html`
   - `sdd/curso-stack-my-architecture-sdd.html`
   - `sdd/index.html`

### Verificación funcional
1. Comparación binaria con fuentes `dist` -> OK (`cmp` en 4/4 archivos).
2. `./scripts/smoke-hub-runtime.sh` -> OK (puerto temporal `46210`).
3. Rutas verificadas dentro del smoke:
   - `/index.html` -> OK
   - `/ios/index.html` -> OK
   - `/android/index.html` -> OK
   - `/sdd/index.html` -> OK

### Resultado
Hub se mantiene estable tras sincronizar Android + SDD.

## Regresión post-sync selectivo cross-course iOS + Android + SDD
### Fecha
2026-02-25

### Contexto
Se detectaron cambios versionables en bundles publicados de `ios`, `android` y `sdd` en Hub y se aplicó sync selectivo cross-course manteniendo política de no publicar WIP fuera de alcance.

### Evidencia versionada
1. Hub sync cross-course: `c9cd8c3` (`chore(hub): sync ios android sdd bundles from source dist`)
2. Scope Hub:
   - `ios/curso-stack-my-architecture.html`
   - `ios/index.html`
   - `android/curso-stack-my-architecture-android.html`
   - `android/index.html`
   - `sdd/curso-stack-my-architecture-sdd.html`
   - `sdd/index.html`

### Verificación funcional
1. Comparación binaria con repos fuente -> OK (`cmp` 6/6):
   - `ios/index.html` se valida contra `stack-my-architecture-ios/dist/curso-stack-my-architecture.html` (mirror operativo del curso en iOS).
2. `./scripts/smoke-hub-runtime.sh` -> OK (puerto temporal `46210`).
3. Rutas verificadas dentro de smoke:
   - `/index.html` -> OK
   - `/ios/index.html` -> OK
   - `/android/index.html` -> OK
   - `/sdd/index.html` -> OK

### Resultado
Hub mantiene estabilidad operativa tras el sync selectivo cross-course.

## Ciclo de espera activa sin publicación
### Fecha
2026-02-25

### Contexto
Se ejecutó ciclo de control para detectar deriva entre bundles publicados del Hub y `dist` de repos fuente, sin cambios de publicación pendientes.

### Verificación funcional
1. `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
2. `./scripts/smoke-hub-runtime.sh` -> OK (puerto temporal `46210`).
3. Rutas verificadas dentro de smoke:
   - `/index.html` -> OK
   - `/ios/index.html` -> OK
   - `/android/index.html` -> OK
   - `/sdd/index.html` -> OK

### Resultado
No se requiere sync selectivo en este ciclo; Hub permanece estable.

## Ciclo de espera activa baseline main (sin publicación)
### Fecha
2026-02-25

### Contexto
Se normalizó el baseline de control en repos fuente para monitoreo operativo:
1. `stack-my-architecture-ios` -> `main`
2. `stack-my-architecture-android` -> `main`
3. `stack-my-architecture-SDD` -> `main` local (sin `merge/rebase` automático contra `origin/main` por política safe).

### Verificación funcional
1. `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
2. `./scripts/smoke-hub-runtime.sh` -> OK (puerto temporal `46210`).
3. Rutas verificadas dentro de smoke:
   - `/index.html` -> OK
   - `/ios/index.html` -> OK
   - `/android/index.html` -> OK
   - `/sdd/index.html` -> OK

### Resultado
No se requiere sync selectivo en este ciclo; Hub permanece estable sobre baseline `main`.

## Ciclo de espera activa baseline develop (sin publicación)
### Fecha
2026-02-25

### Contexto
Se alineó el baseline operativo de repos fuente a `develop` para cumplir contrato GitFlow hard de `AGENTS.md`:
1. `stack-my-architecture-ios` -> `develop`
2. `stack-my-architecture-android` -> `develop`
3. `stack-my-architecture-SDD` -> `develop`

### Verificación funcional
1. `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
2. `./scripts/smoke-hub-runtime.sh` -> OK (puerto temporal `46210`).
3. Rutas verificadas dentro de smoke:
   - `/index.html` -> OK
   - `/ios/index.html` -> OK
   - `/android/index.html` -> OK
   - `/sdd/index.html` -> OK

### Resultado
No se requiere sync selectivo en este ciclo; Hub permanece estable sobre baseline `develop`.

## Ciclo de espera activa recurrente baseline main (sin publicación)
### Fecha
2026-02-25

### Contexto
Se ejecutó un nuevo ciclo operativo de espera activa con baseline actual en `main` para repos fuente:
1. `stack-my-architecture-ios` -> `main`
2. `stack-my-architecture-android` -> `main`
3. `stack-my-architecture-SDD` -> `main` local

### Verificación funcional
1. `./scripts/check-selective-sync-drift.sh` -> `no drift (6/6)`.
2. `./scripts/smoke-hub-runtime.sh` -> OK (puerto temporal `46210`).
3. Rutas verificadas dentro de smoke:
   - `/index.html` -> OK
   - `/ios/index.html` -> OK
   - `/android/index.html` -> OK
   - `/sdd/index.html` -> OK

### Resultado
No se requiere sync selectivo en este ciclo; Hub permanece estable sobre baseline operativo actual (`main`).

## Nota operativa
Si reaparece síntoma similar:
1. Revisar `.runtime/hub.port` y `.runtime/hub.pid` del hub.
2. Validar `/health` + `/index.html` en el puerto activo.
3. Reiniciar Hub con launcher actual.
