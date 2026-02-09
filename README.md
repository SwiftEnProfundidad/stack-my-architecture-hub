# Stack My Architecture Hub

Servidor local unificado para:
- contenido estático del hub (`/`, `/ios`, `/android`)
- proxy de asistente IA (`/health`, `/config`, `/metrics`, `/assistant/query`)

## Arranque recomendado (Node en `:8090`)

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

## Modelos con visión y fallback

- El panel permite seleccionar modelo manualmente.
- Si la consulta incluye imágenes y el modelo no soporta visión:
  - el proxy aplica fallback automático a `gpt-4o-mini`
  - devuelve `warning` en la respuesta para que el panel lo muestre.
