#!/usr/bin/env node

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 8090);
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || '').trim();
const OPENAI_BASE_URL = String(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const HUB_ROOT = path.resolve(__dirname, '..');
const METRICS_PATH = path.join(__dirname, 'metrics.json');

const DEFAULT_MODEL = 'gpt-5.2';
const DEFAULT_MAX_TOKENS = 600;
const MAX_IMAGES = 3;

const AVAILABLE_MODELS = [
    'gpt-5.2',
    'gpt-5.2-2025-12-11',
    'gpt-5.2-chat-latest',
    'gpt-5.2-codex',
    'gpt-5.2-pro',
    'gpt-5.2-pro-2025-12-11',
    'gpt-4o-mini',
    'gpt-4.1-mini'
];

const PRICE_PER_1K = {
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 }
};

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
});

app.use(express.json({ limit: '20mb' }));

const metrics = loadMetrics();

app.get('/health', (_req, res) => {
    res.json({ ok: true, name: 'assistant-bridge', port: PORT });
});

app.get('/config', (_req, res) => {
    res.json({
        ok: true,
        models: AVAILABLE_MODELS,
        default_model: DEFAULT_MODEL,
        max_tokens_default: DEFAULT_MAX_TOKENS
    });
});

app.get('/metrics', (_req, res) => {
    res.json({
        ok: true,
        requests: metrics.requests,
        inputTokens: metrics.inputTokens,
        outputTokens: metrics.outputTokens,
        totalTokens: metrics.totalTokens,
        estimatedCostUsd: Number(metrics.estimatedCostUsd.toFixed(8))
    });
});

app.post('/assistant/query', async (req, res) => {
    if (!OPENAI_API_KEY) {
        return res.status(400).json({
            ok: false,
            error: 'Falta OPENAI_API_KEY en variables de entorno del proxy.'
        });
    }

    try {
        const body = req.body || {};
        const model = String(body.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
        const maxTokens = sanitizeMaxTokens(body.maxTokens);
        const prompt = String(body.prompt || body.question || '').trim();
        const selection = String(body.selection || '').trim();
        const courseId = String(body.courseId || '').trim();
        const topicId = String(body.topicId || '').trim();
        const pageTitle = String(body.pageTitle || '').trim();

        if (!prompt) {
            return res.status(400).json({ ok: false, error: 'El campo prompt es obligatorio.' });
        }

        const images = normalizeImages(body.images);
        const contextText = buildContext({ prompt, selection, courseId, topicId, pageTitle });

        const input = [
            {
                role: 'user',
                content: [
                    { type: 'input_text', text: contextText },
                    ...images.map((img) => ({ type: 'input_image', image_url: img.dataUrl }))
                ]
            }
        ];

        const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model,
                max_output_tokens: maxTokens,
                input
            })
        });

        const json = await response.json();
        if (!response.ok) {
            const detail = json && json.error && json.error.message ? json.error.message : `HTTP ${response.status}`;
            return res.status(502).json({ ok: false, error: `Error de OpenAI: ${detail}` });
        }

        const answer = extractResponseText(json);
        const usage = {
            input_tokens: Number((json.usage && json.usage.input_tokens) || 0),
            output_tokens: Number((json.usage && json.usage.output_tokens) || 0)
        };
        usage.total_tokens = usage.input_tokens + usage.output_tokens;

        applyMetrics(model, usage);

        return res.json({
            ok: true,
            answer,
            usage
        });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: `No se pudo completar la consulta: ${error && error.message ? error.message : 'error desconocido'}`
        });
    }
});

app.use(express.static(HUB_ROOT, { extensions: ['html'] }));

app.get('/', (_req, res) => {
    res.sendFile(path.join(HUB_ROOT, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`[assistant-bridge] Hub + proxy escuchando en http://localhost:${PORT}`);
});

function sanitizeMaxTokens(value) {
    const parsed = Number(value || DEFAULT_MAX_TOKENS);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_TOKENS;
    return Math.max(100, Math.min(2000, Math.round(parsed)));
}

function buildContext({ prompt, selection, courseId, topicId, pageTitle }) {
    const lines = [
        'Responde en español y de forma clara para nivel junior.',
        pageTitle ? `Página: ${pageTitle}` : null,
        courseId ? `Curso: ${courseId}` : null,
        topicId ? `Tema: ${topicId}` : null,
        selection ? `Selección del usuario:\n${selection}` : null,
        `Pregunta:\n${prompt}`
    ].filter(Boolean);
    return lines.join('\n\n');
}

function normalizeImages(rawImages) {
    if (!Array.isArray(rawImages)) return [];
    return rawImages
        .slice(0, MAX_IMAGES)
        .filter((img) => img && typeof img.dataUrl === 'string' && img.dataUrl.startsWith('data:image/'))
        .map((img) => ({
            dataUrl: img.dataUrl,
            mime: String(img.mime || ''),
            name: String(img.name || 'imagen')
        }));
}

function extractResponseText(payload) {
    if (payload && typeof payload.output_text === 'string' && payload.output_text.trim()) {
        return payload.output_text.trim();
    }

    const output = Array.isArray(payload && payload.output) ? payload.output : [];
    for (const item of output) {
        const content = Array.isArray(item && item.content) ? item.content : [];
        for (const chunk of content) {
            if (chunk && typeof chunk.text === 'string' && chunk.text.trim()) {
                return chunk.text.trim();
            }
        }
    }

    return 'No se recibió texto de respuesta.';
}

function loadMetrics() {
    try {
        if (fs.existsSync(METRICS_PATH)) {
            const parsed = JSON.parse(fs.readFileSync(METRICS_PATH, 'utf8'));
            return {
                requests: Number(parsed.requests || 0),
                inputTokens: Number(parsed.inputTokens || 0),
                outputTokens: Number(parsed.outputTokens || 0),
                totalTokens: Number(parsed.totalTokens || 0),
                estimatedCostUsd: Number(parsed.estimatedCostUsd || 0)
            };
        }
    } catch (_err) {
    }

    return {
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0
    };
}

function applyMetrics(model, usage) {
    metrics.requests += 1;
    metrics.inputTokens += Number(usage.input_tokens || 0);
    metrics.outputTokens += Number(usage.output_tokens || 0);
    metrics.totalTokens += Number(usage.total_tokens || 0);

    const price = PRICE_PER_1K[model];
    if (price) {
        const inputCost = (metricsDelta(usage.input_tokens) / 1000) * price.input;
        const outputCost = (metricsDelta(usage.output_tokens) / 1000) * price.output;
        metrics.estimatedCostUsd += inputCost + outputCost;
    }

    persistMetrics();
}

function metricsDelta(v) {
    return Number(v || 0);
}

function persistMetrics() {
    try {
        fs.writeFileSync(METRICS_PATH, JSON.stringify({
            requests: metrics.requests,
            inputTokens: metrics.inputTokens,
            outputTokens: metrics.outputTokens,
            totalTokens: metrics.totalTokens,
            estimatedCostUsd: Number(metrics.estimatedCostUsd.toFixed(8))
        }, null, 2));
    } catch (_err) {
    }
}
