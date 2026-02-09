# Stack My Architecture Hub

Servidor local unificado para:
- contenido estático del hub (`/`, `/ios`, `/android`)
- proxy de asistente IA (`/health`, `/assistant/query`, `/metrics`)

## Arranque recomendado (Node en `:8090`)

1. Detén el servidor Python si está corriendo en `8090`.
2. Exporta tu clave OpenAI:

```bash
export OPENAI_API_KEY="sk-..."
```

3. Instala dependencias del proxy:

```bash
cd assistant-bridge
npm install
```

4. Arranca el servidor:

```bash
npm start
```

5. Abre el hub:

```text
http://localhost:8090/index.html
```

## Endpoint de salud

```bash
curl http://localhost:8090/health
```

## Métricas

```bash
curl http://localhost:8090/metrics
```

## Consulta de ejemplo

```bash
curl -X POST http://localhost:8090/assistant/query \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "maxTokens": 600,
    "prompt": "Explícame qué es un Repository Pattern",
    "courseId": "ios",
    "topicId": "arquitectura"
  }'
```

## Script rápido

También puedes ejecutar:

```bash
./open-proxy.command
```

El script valida que `OPENAI_API_KEY` exista, instala dependencias y arranca el servidor en `8090`.
