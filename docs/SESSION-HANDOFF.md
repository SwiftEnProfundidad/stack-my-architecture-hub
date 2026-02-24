# SESSION HANDOFF

Fecha de corte: 2026-02-24

## Estado actual
Workspace unificado en:
`/Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture`

Repos incluidos:
1. `stack-my-architecture-hub`
2. `stack-my-architecture-SDD`
3. `stack-my-architecture-ios`
4. `stack-my-architecture-android`

## Último hito cerrado
1. Hub estabilizado y funcional para abrir cursos.
2. Commit: `1940c7d`
3. Tag: `hub-stable-20260224`

## Último bloque operativo cerrado
1. Sync de bundles publicados del Hub con repos fuente (`ios`, `android`, `sdd`).
2. Commit: `b4399a7` (`chore(hub): sync published course bundles`)
3. Validación runtime:
   - `./scripts/smoke-hub-runtime.sh` -> OK
   - `/index.html`, `/ios/index.html`, `/android/index.html`, `/sdd/index.html` -> HTTP 200

## Trabajo en curso
1. Asegurar continuidad de contexto entre chats/sesiones.
2. Estandarizar seguimiento con documentos de control en `docs/`.
3. Mantener commits atómicos: contenido publicado y tracking en bloques separados.

## Siguiente paso concreto
1. Usar este paquete `docs/` como base del seguimiento del nuevo thread.
2. Si cambian repos fuente, ejecutar sync/publicación del Hub y validar smoke+rutas.
3. Mantener actualización de este archivo al cerrar cada bloque de trabajo.

## Riesgos abiertos
1. `codex resume` filtra por `cwd` si no se usa `--all`.
2. El índice de sesiones puede reflejar con desfase respecto al chat activo.
3. Riesgo de deriva de contexto si no se priorizan estos 4 documentos como fuente de verdad.

## Comandos útiles de continuidad
1. Ver todo en picker:
`codex resume --all`
2. Abrir hilo renombrado en raíz nueva:
`codex resume "UNIFY-WORKSPACE-STACK-ARCHITECTURE" --all -C "/Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture"`
3. Crear sesión nueva en esta raíz:
`cd "/Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture" && codex`
