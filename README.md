# Stack My Architecture Hub

Servidor local unificado para:
- contenido estático del hub (`/`, `/ios`, `/android`, `/sdd`)
- proxy de asistente IA (`/health`, `/config`, `/metrics`, `/assistant/query`)

## Arranque robusto recomendado

El launcher robusto evita depender de `~/.zshrc`, elige un puerto libre no genérico (prioriza `46100+`), mantiene PID y logs en `.runtime/` y abre el Hub o el curso que indiques.

```bash
./open-proxy.command
```

Abrir directamente un curso:

```bash
./open-proxy.command --course sdd
./open-proxy.command ios
./open-proxy.command android
```

Opcional: fijar puerto manualmente.

```bash
STACK_MY_ARCH_HUB_PORT=46200 ./open-proxy.command
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

4. Abre el hub:

```text
http://localhost:8090/index.html
```

También puedes usar:

```bash
./open-proxy.command
```

## Endpoints

```bash
curl http://localhost:8090/health
curl http://localhost:8090/config
curl http://localhost:8090/metrics
```

Consulta:

```bash
curl -X POST http://localhost:8090/assistant/query \
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
