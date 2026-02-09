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

const QUERY_PATH = '/assistant/query';
const QUERY_ALIAS_PATH = '/ask';
const DEFAULT_MODEL = String(process.env.OPENAI_MODEL_DEFAULT || 'gpt-5.2').trim();
const AVAILABLE_MODELS = (process.env.OPENAI_ALLOWED_MODELS || [
    'gpt-5.2',
    'gpt-5.2-2025-12-11',
    'gpt-5.2-chat-latest',
    'gpt-5.2-codex',
    'gpt-5.2-pro',
    'gpt-5.2-pro-2025-12-11',
    'gpt-4o-mini',
    'gpt-4.1-mini'
].join(','))
    .split(',')
    .map((value) => String(value || '').trim())
    .filter(Boolean);

const VISION_MODELS = (process.env.OPENAI_VISION_MODELS || 'gpt-4o-mini')
    .split(',')
    .map((value) => String(value || '').trim())
    .filter(Boolean);

const DEFAULT_MAX_TOKENS = Number(process.env.ASSISTANT_MAX_TOKENS_DEFAULT || 600);
const MAX_TOKENS_CAP = Number(process.env.ASSISTANT_MAX_TOKENS_CAP || 1200);
const SOFT_DAILY_BUDGET_USD = Number(process.env.ASSISTANT_SOFT_DAILY_BUDGET_USD || 2.0);
const DAILY_WARNING_USD = Number(process.env.ASSISTANT_DAILY_WARNING_USD || 0.25);

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg'];

const PRICE_PER_1K = {
    'gpt-5.2': { input: 0.0012, output: 0.0048 },
    'gpt-5.2-2025-12-11': { input: 0.0012, output: 0.0048 },
    'gpt-5.2-chat-latest': { input: 0.0012, output: 0.0048 },
    'gpt-5.2-codex': { input: 0.0012, output: 0.0048 },
    'gpt-5.2-pro': { input: 0.0012, output: 0.0048 },
    'gpt-5.2-pro-2025-12-11': { input: 0.0012, output: 0.0048 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4.1-mini': { input: 0.0004, output: 0.0016 }
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
    res.json({ ok: true, service: 'assistant-bridge', port: PORT, query_path: QUERY_PATH });
});

app.get('/config', (_req, res) => {
    res.json({
        ok: true,
        models: AVAILABLE_MODELS,
        default_model: DEFAULT_MODEL,
        max_tokens_default: DEFAULT_MAX_TOKENS,
        max_tokens_cap: MAX_TOKENS_CAP,
        soft_daily_budget_usd: SOFT_DAILY_BUDGET_USD,
        daily_warning_usd: DAILY_WARNING_USD,
        max_images: MAX_IMAGES,
        max_image_bytes: MAX_IMAGE_BYTES,
        vision_models: VISION_MODELS,
        query_path: QUERY_PATH
    });
});

app.get('/metrics', (_req, res) => {
    rollDailyIfNeeded();
    res.json(metricsPayload());
});

app.post(QUERY_PATH, handleQuery);
app.post(QUERY_ALIAS_PATH, handleQuery);

app.use(express.static(HUB_ROOT, { extensions: ['html'] }));

app.get('/', (_req, res) => {
    res.sendFile(path.join(HUB_ROOT, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`[assistant-bridge] Hub + proxy escuchando en http://localhost:${PORT}`);
});

async function handleQuery(req, res) {
    if (!OPENAI_API_KEY) {
        return res.status(400).json({
            ok: false,
            error: 'Falta OPENAI_API_KEY en variables de entorno del proxy.'
        });
    }

    try {
        const body = req.body || {};
        const prompt = String(body.prompt || body.question || '').trim();
        if (!prompt) {
            return res.status(400).json({ ok: false, error: 'El campo prompt es obligatorio.' });
        }

        const selectedModel = AVAILABLE_MODELS.includes(body.model) ? body.model : DEFAULT_MODEL;
        const maxTokens = sanitizeMaxTokens(body.maxTokens);
        const imagesResult = normalizeImages(body.images);
        if (imagesResult.error) {
            return res.status(400).json({ ok: false, error: imagesResult.error });
        }

        const images = imagesResult.value;
        const memory = normalizeMemory(body.memory);
        const context = resolveContext(body);

        let warning = null;
        let model = selectedModel;

        if (images.length > 0 && !VISION_MODELS.includes(model)) {
            model = 'gpt-4o-mini';
            warning = `El modelo ${selectedModel} no soporta visión. Fallback automático a ${model}.`;
        }

        const contextText = buildContext({
            prompt,
            selection: context.selectedText,
            surroundingContext: context.surroundingContext,
            courseId: context.courseId,
            topicId: context.topicId,
            pageTitle: context.pageTitle,
            memory
        });

        rollDailyIfNeeded();
        if (SOFT_DAILY_BUDGET_USD > 0 && metrics.daily.estimatedCostUsd >= SOFT_DAILY_BUDGET_USD) {
            warning = warning
                ? `${warning} Presupuesto diario superado (soft limit).`
                : 'Presupuesto diario superado (soft limit).';
        }

        const completion = await callOpenAI({
            model,
            maxTokens,
            contextText,
            images
        });

        const answer = extractResponseText(completion);
        const usage = normalizeUsage(completion);
        const estimatedCostUsd = estimateCost(model, usage.inputTokens, usage.outputTokens);

        applyMetrics({
            model,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            totalTokens: usage.totalTokens,
            estimatedCostUsd,
            imagesCount: images.length
        });

        images.forEach((item) => {
            item.data = '';
        });

        return res.json({
            ok: true,
            answer,
            model,
            selectedModel,
            warning,
            hasImages: images.length > 0,
            imagesCount: images.length,
            usage: {
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                totalTokens: usage.totalTokens,
                estimatedCostUsd,
                hasImages: images.length > 0,
                imagesCount: images.length,
                input_tokens: usage.inputTokens,
                output_tokens: usage.outputTokens,
                total_tokens: usage.totalTokens,
                estimated_cost_usd: estimatedCostUsd
            },
            metrics: metricsPayload()
        });
    } catch (error) {
        const message = error && error.message ? error.message : 'error desconocido';
        return res.status(500).json({
            ok: false,
            error: `No se pudo completar la consulta: ${message}`
        });
    }
}

function resolveContext(body) {
    const context = body && body.context && typeof body.context === 'object' ? body.context : {};
    return {
        courseId: String(body.courseId || context.courseId || '').trim(),
        topicId: String(body.topicId || context.topicId || '').trim(),
        selectedText: String(body.selectedText || context.selectedText || '').trim(),
        surroundingContext: String(body.surroundingContext || context.surroundingContext || '').trim(),
        pageTitle: String(body.pageTitle || context.pageTitle || '').trim()
    };
}

function sanitizeMaxTokens(value) {
    const parsed = Number(value || DEFAULT_MAX_TOKENS);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_TOKENS;
    return Math.max(100, Math.min(MAX_TOKENS_CAP, Math.round(parsed)));
}

function normalizeMemory(memory) {
    if (!memory || typeof memory !== 'object') return { conversation_summary: '', recent_messages: [] };

    const conversationSummary = String(memory.conversation_summary || '').trim().slice(0, 1800);
    const recentMessages = Array.isArray(memory.recent_messages)
        ? memory.recent_messages
            .map((item) => {
                if (!item || typeof item !== 'object') return null;
                const role = item.role === 'assistant' ? 'assistant' : 'user';
                const text = String(item.text || '').trim().slice(0, 900);
                if (!text) return null;
                return { role, text };
            })
            .filter(Boolean)
            .slice(-8)
        : [];

    return {
        conversation_summary: conversationSummary,
        recent_messages: recentMessages
    };
}

function buildContext({ prompt, selection, surroundingContext, courseId, topicId, pageTitle, memory }) {
    const lines = [
        'Responde en español y de forma clara para nivel junior.',
        pageTitle ? `Página: ${pageTitle}` : null,
        courseId ? `Curso: ${courseId}` : null,
        topicId ? `Tema: ${topicId}` : null
    ].filter(Boolean);

    if (memory && memory.conversation_summary) {
        lines.push('', 'conversation_summary:', memory.conversation_summary);
    }

    if (memory && Array.isArray(memory.recent_messages) && memory.recent_messages.length) {
        lines.push('', 'recent_messages:');
        memory.recent_messages.forEach((item) => {
            lines.push(`- ${item.role}: ${item.text}`);
        });
    }

    if (selection) lines.push('', `Selección del usuario:\n${selection}`);
    if (surroundingContext) lines.push('', `Contexto cercano:\n${surroundingContext}`);
    lines.push('', `Pregunta:\n${prompt}`);

    return lines.join('\n\n');
}

function normalizeImageType(type) {
    const normalized = String(type || '').toLowerCase().trim();
    if (normalized === 'image/jpg') return 'image/jpeg';
    return normalized;
}

function normalizeBase64(value) {
    return String(value || '').replace(/\s+/g, '').trim();
}

function base64ByteLength(base64) {
    const normalized = normalizeBase64(base64);
    if (!normalized) return 0;
    const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
    return Math.floor((normalized.length * 3) / 4) - padding;
}

function extractBase64(raw, type) {
    if (!raw || typeof raw !== 'object') return '';

    if (typeof raw.data === 'string' && raw.data.trim()) {
        return normalizeBase64(raw.data);
    }

    if (typeof raw.dataUrl === 'string' && raw.dataUrl.trim()) {
        const prefix = `data:${type};base64,`;
        if (!raw.dataUrl.startsWith(prefix)) return '';
        return normalizeBase64(raw.dataUrl.slice(prefix.length));
    }

    return '';
}

function normalizeImages(rawImages) {
    if (!Array.isArray(rawImages) || !rawImages.length) return { value: [] };

    if (rawImages.length > MAX_IMAGES) {
        return { error: `Máximo ${MAX_IMAGES} imágenes por consulta.` };
    }

    const images = [];
    for (const raw of rawImages) {
        const type = normalizeImageType(raw && raw.type);
        if (!ALLOWED_IMAGE_TYPES.includes(type)) {
            return { error: 'Formato de imagen no permitido. Usa PNG o JPEG.' };
        }

        const data = extractBase64(raw, type);
        if (!data) {
            return { error: 'Imagen inválida en payload.' };
        }

        const bytes = base64ByteLength(data);
        if (!bytes || bytes > MAX_IMAGE_BYTES) {
            return { error: 'Una imagen supera el tamaño máximo permitido (3MB).' };
        }

        images.push({
            name: String((raw && raw.name) || 'imagen').slice(0, 120),
            type,
            data,
            sizeBytes: bytes
        });
    }

    return { value: images };
}

async function callOpenAI({ model, maxTokens, contextText, images }) {
    const userContent = [{ type: 'input_text', text: contextText }];

    images.forEach((img) => {
        userContent.push({
            type: 'input_image',
            image_url: `data:${img.type};base64,${img.data}`
        });
    });

    const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model,
            max_output_tokens: maxTokens,
            input: [
                {
                    role: 'user',
                    content: userContent
                }
            ]
        })
    });

    const json = await response.json();
    if (!response.ok) {
        const detail = json && json.error && json.error.message ? json.error.message : `HTTP ${response.status}`;
        throw new Error(`Error de OpenAI: ${detail}`);
    }

    return json;
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

function normalizeUsage(payload) {
    const usage = payload && payload.usage ? payload.usage : {};
    const inputTokens = Number(usage.input_tokens || usage.prompt_tokens || usage.inputTokens || 0);
    const outputTokens = Number(usage.output_tokens || usage.completion_tokens || usage.outputTokens || 0);
    const totalTokens = Number(usage.total_tokens || usage.totalTokens || inputTokens + outputTokens);

    return {
        inputTokens,
        outputTokens,
        totalTokens
    };
}

function estimateCost(model, inputTokens, outputTokens) {
    const price = PRICE_PER_1K[model] || PRICE_PER_1K['gpt-4o-mini'];
    const inputCost = (Number(inputTokens || 0) / 1000) * Number(price.input || 0);
    const outputCost = (Number(outputTokens || 0) / 1000) * Number(price.output || 0);
    return Number((inputCost + outputCost).toFixed(8));
}

function dateKeyToday() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function createEmptyDaily(dateKey) {
    return {
        dateKey,
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        imagesCount: 0
    };
}

function loadMetrics() {
    const defaultMetrics = {
        startedAt: new Date().toISOString(),
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalEstimatedCostUsd: 0,
        totalImagesCount: 0,
        daily: createEmptyDaily(dateKeyToday()),
        lastRequest: null
    };

    try {
        if (!fs.existsSync(METRICS_PATH)) {
            return defaultMetrics;
        }

        const parsed = JSON.parse(fs.readFileSync(METRICS_PATH, 'utf8'));

        const totalRequests = Number(parsed.totalRequests || parsed.total_requests || parsed.requests || 0);
        const totalInputTokens = Number(parsed.totalInputTokens || parsed.total_input_tokens || parsed.inputTokens || 0);
        const totalOutputTokens = Number(parsed.totalOutputTokens || parsed.total_output_tokens || parsed.outputTokens || 0);
        const totalTokens = Number(parsed.totalTokens || parsed.total_tokens || parsed.totalTokens || 0);
        const totalEstimatedCostUsd = Number(
            parsed.totalEstimatedCostUsd ||
            parsed.total_estimated_cost_usd ||
            parsed.estimatedCostUsd ||
            0
        );
        const totalImagesCount = Number(parsed.totalImagesCount || parsed.total_images_count || parsed.imagesCount || 0);

        const dailyInput = parsed.daily && typeof parsed.daily === 'object' ? parsed.daily : {};
        const dailyDate = String(dailyInput.dateKey || dailyInput.date_key || dateKeyToday());

        return {
            startedAt: String(parsed.startedAt || parsed.started_at || defaultMetrics.startedAt),
            totalRequests,
            totalInputTokens,
            totalOutputTokens,
            totalTokens,
            totalEstimatedCostUsd,
            totalImagesCount,
            daily: {
                dateKey: dailyDate,
                requests: Number(dailyInput.requests || 0),
                inputTokens: Number(dailyInput.inputTokens || dailyInput.input_tokens || 0),
                outputTokens: Number(dailyInput.outputTokens || dailyInput.output_tokens || 0),
                totalTokens: Number(dailyInput.totalTokens || dailyInput.total_tokens || 0),
                estimatedCostUsd: Number(dailyInput.estimatedCostUsd || dailyInput.estimated_cost_usd || 0),
                imagesCount: Number(dailyInput.imagesCount || dailyInput.images_count || 0)
            },
            lastRequest: parsed.lastRequest || parsed.last_request || null
        };
    } catch (_err) {
        return defaultMetrics;
    }
}

function rollDailyIfNeeded() {
    const today = dateKeyToday();
    if (metrics.daily.dateKey === today) return;
    metrics.daily = createEmptyDaily(today);
    persistMetrics();
}

function applyMetrics({ model, inputTokens, outputTokens, totalTokens, estimatedCostUsd, imagesCount }) {
    metrics.totalRequests += 1;
    metrics.totalInputTokens += Number(inputTokens || 0);
    metrics.totalOutputTokens += Number(outputTokens || 0);
    metrics.totalTokens += Number(totalTokens || 0);
    metrics.totalEstimatedCostUsd = Number((metrics.totalEstimatedCostUsd + Number(estimatedCostUsd || 0)).toFixed(8));
    metrics.totalImagesCount += Number(imagesCount || 0);

    metrics.daily.requests += 1;
    metrics.daily.inputTokens += Number(inputTokens || 0);
    metrics.daily.outputTokens += Number(outputTokens || 0);
    metrics.daily.totalTokens += Number(totalTokens || 0);
    metrics.daily.estimatedCostUsd = Number((metrics.daily.estimatedCostUsd + Number(estimatedCostUsd || 0)).toFixed(8));
    metrics.daily.imagesCount += Number(imagesCount || 0);

    metrics.lastRequest = {
        at: new Date().toISOString(),
        model,
        inputTokens: Number(inputTokens || 0),
        outputTokens: Number(outputTokens || 0),
        totalTokens: Number(totalTokens || 0),
        estimatedCostUsd: Number(estimatedCostUsd || 0),
        hasImages: Number(imagesCount || 0) > 0,
        imagesCount: Number(imagesCount || 0)
    };

    persistMetrics();
}

function metricsPayload() {
    return {
        ok: true,
        started_at: metrics.startedAt,
        total_requests: metrics.totalRequests,
        total_input_tokens: metrics.totalInputTokens,
        total_output_tokens: metrics.totalOutputTokens,
        total_tokens: metrics.totalTokens,
        total_estimated_cost_usd: Number(metrics.totalEstimatedCostUsd.toFixed(8)),
        total_images_count: metrics.totalImagesCount,
        session_total_cost_usd: Number(metrics.totalEstimatedCostUsd.toFixed(8)),
        soft_daily_budget_usd: SOFT_DAILY_BUDGET_USD,
        daily_warning_usd: DAILY_WARNING_USD,
        daily: {
            date_key: metrics.daily.dateKey,
            requests: metrics.daily.requests,
            input_tokens: metrics.daily.inputTokens,
            output_tokens: metrics.daily.outputTokens,
            total_tokens: metrics.daily.totalTokens,
            estimated_cost_usd: Number(metrics.daily.estimatedCostUsd.toFixed(8)),
            images_count: metrics.daily.imagesCount
        },
        last_request: metrics.lastRequest,
        requests: metrics.totalRequests,
        inputTokens: metrics.totalInputTokens,
        outputTokens: metrics.totalOutputTokens,
        totalTokens: metrics.totalTokens,
        estimatedCostUsd: Number(metrics.totalEstimatedCostUsd.toFixed(8))
    };
}

function persistMetrics() {
    try {
        fs.writeFileSync(METRICS_PATH, JSON.stringify({
            startedAt: metrics.startedAt,
            totalRequests: metrics.totalRequests,
            totalInputTokens: metrics.totalInputTokens,
            totalOutputTokens: metrics.totalOutputTokens,
            totalTokens: metrics.totalTokens,
            totalEstimatedCostUsd: Number(metrics.totalEstimatedCostUsd.toFixed(8)),
            totalImagesCount: metrics.totalImagesCount,
            daily: {
                dateKey: metrics.daily.dateKey,
                requests: metrics.daily.requests,
                inputTokens: metrics.daily.inputTokens,
                outputTokens: metrics.daily.outputTokens,
                totalTokens: metrics.daily.totalTokens,
                estimatedCostUsd: Number(metrics.daily.estimatedCostUsd.toFixed(8)),
                imagesCount: metrics.daily.imagesCount
            },
            lastRequest: metrics.lastRequest
        }, null, 2));
    } catch (_err) {
    }
}
