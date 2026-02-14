# Stack My Architecture Hub

Servidor local unificado para:
- contenido estático del hub (`/`, `/ios`, `/android`, `/sdd`)
- proxy de asistente IA (`/health`, `/config`, `/metrics`, `/assistant/query`)

## Arranque robusto recomendado

El launcher robusto evita depender de `~/.zshrc`, elige un puerto libre no genérico (prioriza `46100+`), mantiene PID y logs en `.runtime/` y abre el Hub o el curso que indiques.

```bash
/Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture-hub/open-proxy.command
```

Abrir directamente un curso:

```bash
/Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture-hub/open-proxy.command --course sdd
/Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture-hub/open-proxy.command ios
/Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture-hub/open-proxy.command android
```

Opcional: fijar puerto manualmente.

```bash
STACK_MY_ARCH_HUB_PORT=46200 /Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture-hub/open-proxy.command
```

Si quieres evitar completamente llamadas manuales en terminal, crea la app de Escritorio y abre el curso con doble clic:

```bash
/bin/zsh -f /Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture-hub/scripts/install-desktop-app.sh
```

Detener hub:

```bash
/bin/zsh -f scripts/stop-hub.sh
```

Crear app de Escritorio (doble clic):

```bash
/bin/zsh -f scripts/install-desktop-app.sh
```

## Arranque manual (Node)

1. Exporta tu clave OpenAI:

```bash
export OPENAI_API_KEY="sk-..."
```

2. Instala dependencias:

```bash
cd assistant-bridge
npm install
```

3. Arranca el proxy + hub:

```bash
npm start
```

4. Abre el hub en el puerto elegido por el launcher (se guarda en `.runtime/hub.port`):

```bash
PORT="$(cat .runtime/hub.port)"
open "http://127.0.0.1:${PORT}/index.html"
```

También puedes usar directamente el launcher robusto:

```bash
/Users/juancarlosmerlosalbarracin/Developer/Projects/stack-my-architecture-hub/open-proxy.command
```

## Endpoints

```bash
PORT="$(cat .runtime/hub.port)"
curl "http://127.0.0.1:${PORT}/health"
curl "http://127.0.0.1:${PORT}/config"
curl "http://127.0.0.1:${PORT}/metrics"
```

## Publicación del hub con gate SDD

Para regenerar y copiar los tres cursos al hub:

```bash
./scripts/build-hub.sh
```

Desde ahora, la publicación del curso SDD pasa por gate estricto automático:

- ejecuta `stack-my-architecture-SDD/scripts/run-full-audit.sh`
- si falla cualquier validación/tests/build, el hub no publica SDD

Modo rápido solo para debug local (no recomendado para publicar):

```bash
./scripts/build-hub.sh --fast
```

También puedes usar:

```bash
./scripts/build-hub.sh --mode strict
./scripts/build-hub.sh --mode fast
```

Compatibilidad legacy:

```bash
SKIP_SDD_AUDIT=1 ./scripts/build-hub.sh
```

El script además deja traza en `.runtime/build-hub.log`, evita ejecuciones concurrentes con lock y recupera automáticamente locks obsoletos (stale) tras cierres inesperados.
Además ejecuta un smoke test final de publicación (`scripts/verify-hub-build.py`) para validar que rutas y assets críticos quedaron consistentes antes de marcar el build como correcto.
En modo `strict`, también ejecuta smoke runtime real (`scripts/smoke-hub-runtime.sh`) levantando un servidor temporal y verificando endpoints (`/health`, `/config`, `/ios`, `/android`, `/sdd`).
Al finalizar, genera `.runtime/build-manifest.json` con trazabilidad de publicación (commits, hashes y tamaños de artefactos copiados).

Si necesitas saltar el smoke runtime puntualmente:

```bash
SKIP_RUNTIME_SMOKE=1 ./scripts/build-hub.sh --strict
```

Consulta:

```bash
PORT="$(cat .runtime/hub.port)"
curl -X POST "http://127.0.0.1:${PORT}/assistant/query" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "maxTokens": 600,
    "prompt": "Explícame este diagrama",
    "context": {
      "courseId": "stack-my-architecture-ios",
      "topicId": "tema-actual"
    },
    "images": []
  }'
```

## Adjuntos de imágenes

- Máximo `3` imágenes por consulta.
- Tipos permitidos: `image/png` y `image/jpeg`.
- Tamaño máximo por imagen (tras compresión): `3MB`.
- Formato esperado por imagen:

```json
{
  "name": "captura.png",
  "type": "image/png",
  "data": "<base64-sin-prefijo>"
}
```

- Puedes adjuntar también con:
  - `⌘V` / `Ctrl+V` (pegar captura desde portapapeles)
  - drag & drop directamente sobre el panel del asistente.

## Modelos con visión y fallback

- El panel permite seleccionar modelo manualmente.
- Si la consulta incluye imágenes y el modelo no soporta visión:
  - el proxy aplica fallback automático a `gpt-4o-mini`
  - devuelve `warning` en la respuesta para que el panel lo muestre.

## Caché y limpieza de historial IA

- El panel incluye caché local por curso (`Usar caché`) para reutilizar respuestas de consultas idénticas.
- Puedes limpiar manualmente con `🧽 Limpiar caché`.
- `🧹 Limpiar contexto` reinicia contexto conversacional del hilo actual.
- `🗑 Borrar historial IA` borra historial/memoria del asistente del curso actual sin tocar progreso de estudio.
