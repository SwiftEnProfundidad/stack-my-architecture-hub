#!/usr/bin/env node

const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 8090);
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || '').trim();
const OPENAI_BASE_URL = String(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const HUB_ROOT = path.resolve(__dirname, '..');
const METRICS_PATH = path.join(__dirname, 'metrics.json');
const THREADS_DIR = path.join(__dirname, 'threads');

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

const VISION_FALLBACK_MODEL = String(process.env.OPENAI_VISION_FALLBACK_MODEL || 'gpt-4o-mini').trim();
const VISION_MODELS = (process.env.OPENAI_VISION_MODELS || 'gpt-5.3*,gpt-5.2*,gpt-4.1-mini,gpt-4o-mini')
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
const IMAGE_MAX_WIDTH = 1280;
const IMAGE_JPEG_QUALITY = 0.85;
const MEMORY_CONFIG_MAX_TURNS = 8;

const THREAD_WINDOW_TURNS = toInt(process.env.ASSISTANT_THREAD_WINDOW_TURNS, 10, 6, 16);
const MAX_TURNS_BEFORE_SUMMARY = toInt(process.env.ASSISTANT_MAX_TURNS_BEFORE_SUMMARY, 14, THREAD_WINDOW_TURNS + 2, 60);
const THREAD_SUMMARY_MAX_CHARS = toInt(process.env.ASSISTANT_THREAD_SUMMARY_MAX_CHARS, 2400, 600, 6000);
const THREAD_TURN_MAX_CHARS = toInt(process.env.ASSISTANT_THREAD_TURN_MAX_CHARS, 1800, 200, 6000);
const THREAD_HARD_LIMIT = Math.max(MAX_TURNS_BEFORE_SUMMARY + THREAD_WINDOW_TURNS + 4, 40);
const SUMMARY_MODEL_PREFERRED = String(process.env.ASSISTANT_SUMMARY_MODEL || 'gpt-4o-mini').trim();
const SUMMARY_MAX_TOKENS = toInt(process.env.ASSISTANT_SUMMARY_MAX_TOKENS, 260, 100, 600);

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

const threadStore = Object.create(null);
const THREAD_STORE_MAX = 200;
const THREAD_STORE_EVICT = 50;
ensureThreadsDir();

function isAllowedOrigin(origin) {
    if (!origin) return true;
    const normalized = String(origin).toLowerCase().replace(/\/$/, '');
    return normalized.startsWith('http://localhost:') || normalized.startsWith('http://127.0.0.1:') || normalized === 'http://localhost' || normalized === 'http://127.0.0.1';
}

function evictOldThreads() {
    const keys = Object.keys(threadStore);
    if (keys.length <= THREAD_STORE_MAX) return;
    keys.sort((a, b) => {
        const ta = threadStore[a] && threadStore[a].updatedAt ? threadStore[a].updatedAt : '';
        const tb = threadStore[b] && threadStore[b].updatedAt ? threadStore[b].updatedAt : '';
        return ta < tb ? -1 : 1;
    });
    keys.slice(0, THREAD_STORE_EVICT).forEach((key) => { delete threadStore[key]; });
}

app.use((req, res, next) => {
    const origin = req.headers && req.headers.origin ? String(req.headers.origin) : '';
    if (origin && !isAllowedOrigin(origin)) {
        return res.status(403).json({ ok: false, error: 'Origen no permitido.' });
    }
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
});

app.use((req, res, next) => {
    const reqPath = String(req.path || '').replace(/\\/g, '/');
    if (reqPath.startsWith('/assistant-bridge/')) {
        return res.status(403).json({ ok: false, error: 'Acceso denegado.' });
    }
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
        schemaVersion: 1,
        models: AVAILABLE_MODELS,
        default_model: DEFAULT_MODEL,
        max_tokens_default: DEFAULT_MAX_TOKENS,
        max_tokens_cap: MAX_TOKENS_CAP,
        soft_daily_budget_usd: SOFT_DAILY_BUDGET_USD,
        daily_warning_usd: DAILY_WARNING_USD,
        max_images: MAX_IMAGES,
        max_image_bytes: MAX_IMAGE_BYTES,
        vision_models: VISION_MODELS,
        query_path: QUERY_PATH,
        thread_window_turns: THREAD_WINDOW_TURNS,
        max_turns_before_summary: MAX_TURNS_BEFORE_SUMMARY,
        summary_model: pickSummaryModel(DEFAULT_MODEL),
        images: {
            maxCount: MAX_IMAGES,
            maxBytes: MAX_IMAGE_BYTES,
            maxWidth: IMAGE_MAX_WIDTH,
            jpegQuality: IMAGE_JPEG_QUALITY
        },
        memory: {
            maxTurns: MEMORY_CONFIG_MAX_TURNS,
            summaryEnabled: true
        }
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
        const message = String(body.message || body.prompt || body.question || '').trim();
        if (!message) {
            return res.status(400).json({ ok: false, error: 'El campo message (o prompt) es obligatorio.' });
        }

        const rawThreadId = sanitizeThreadId(body.threadId);
        const threadId = rawThreadId || createThreadId();
        const thread = getThreadState(threadId);

        // Compatibilidad: si llega memoria legacy y el hilo está vacío, se hidrata una vez.
        hydrateThreadFromLegacyMemory(thread, body.memory);

        appendTurn(thread, 'user', message);
        persistThreadState(threadId);

        const selectedModel = AVAILABLE_MODELS.includes(body.model) ? body.model : DEFAULT_MODEL;
        const maxTokens = sanitizeMaxTokens(body.maxTokens);
        const imagesResult = normalizeImages(body.images);
        if (imagesResult.error) {
            // revertir turno de usuario añadido si la request es inválida
            if (thread.turns.length && thread.turns[thread.turns.length - 1].role === 'user') {
                thread.turns.pop();
                touchThread(thread);
                persistThreadState(threadId);
            }
            return res.status(400).json({ ok: false, error: imagesResult.error });
        }

        const images = imagesResult.value;
        const context = resolveContext(body);

        let warning = null;
        let model = selectedModel;

        if (images.length > 0 && !supportsVisionModel(model)) {
            model = VISION_FALLBACK_MODEL;
            warning = `El modelo ${selectedModel} no soporta visión. Fallback automático a ${model}.`;
        }

        rollDailyIfNeeded();
        if (SOFT_DAILY_BUDGET_USD > 0 && metrics.daily.estimatedCostUsd >= SOFT_DAILY_BUDGET_USD) {
            warning = warning
                ? `${warning} Presupuesto diario superado (soft limit).`
                : 'Presupuesto diario superado (soft limit).';
        }

        const completion = await callOpenAIQuery({
            model,
            maxTokens,
            thread,
            context,
            images
        });

        const answer = extractResponseText(completion);
        appendTurn(thread, 'assistant', answer);

        const summaryResult = await maybeRefreshThreadSummary({ thread, model });
        persistThreadState(threadId);

        const completionUsage = normalizeUsage(completion);
        const summaryUsage = summaryResult && summaryResult.usage ? summaryResult.usage : emptyUsage();
        const usage = addUsage(completionUsage, summaryUsage);

        const completionCost = estimateCost(model, completionUsage.inputTokens, completionUsage.outputTokens);
        const summaryCost = estimateCost(
            summaryResult.model || pickSummaryModel(model),
            summaryUsage.inputTokens,
            summaryUsage.outputTokens
        );
        const estimatedCostUsd = Number((completionCost + summaryCost).toFixed(8));

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

        const mergedWarning = [warning, summaryResult.warning].filter(Boolean).join(' ').trim() || null;

        return res.json({
            ok: true,
            answer,
            threadId,
            summary: thread.summary || '',
            summaryUpdated: Boolean(summaryResult.summarized),
            model,
            selectedModel,
            warning: mergedWarning,
            hasImages: images.length > 0,
            imagesCount: images.length,
            estimatedCostUsd,
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
        pageTitle: String(body.pageTitle || context.pageTitle || '').trim(),
        selection: String(body.selection || body.selectedText || context.selection || context.selectedText || '').trim(),
        surroundingContext: String(body.surroundingContext || context.surroundingContext || '').trim()
    };
}

function sanitizeMaxTokens(value) {
    const parsed = Number(value || DEFAULT_MAX_TOKENS);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_TOKENS;
    return Math.max(100, Math.min(MAX_TOKENS_CAP, Math.round(parsed)));
}

function normalizeMemory(memory) {
    if (!memory || typeof memory !== 'object') return { conversation_summary: '', recent_messages: [] };

    const conversationSummary = String(memory.conversation_summary || '').trim().slice(0, THREAD_SUMMARY_MAX_CHARS);
    const recentMessages = Array.isArray(memory.recent_messages)
        ? memory.recent_messages
            .map((item) => {
                if (!item || typeof item !== 'object') return null;
                const role = item.role === 'assistant' ? 'assistant' : 'user';
                const text = String(item.text || '').trim().slice(0, THREAD_TURN_MAX_CHARS);
                if (!text) return null;
                return { role, text };
            })
            .filter(Boolean)
            .slice(-THREAD_WINDOW_TURNS)
        : [];

    return {
        conversation_summary: conversationSummary,
        recent_messages: recentMessages
    };
}

function hydrateThreadFromLegacyMemory(thread, rawMemory) {
    if (!thread || thread.turns.length > 0 || thread.summary) return;
    const memory = normalizeMemory(rawMemory);
    if (!memory.conversation_summary && !memory.recent_messages.length) return;

    thread.summary = truncateText(memory.conversation_summary, THREAD_SUMMARY_MAX_CHARS);
    memory.recent_messages.forEach((item) => {
        appendTurn(thread, item.role, item.text);
    });
    touchThread(thread);
}

function buildAssistantInstructions(summary) {
    const lines = [
        'Eres el asistente del curso Stack My Architecture.',
        'Responde en español claro, con enfoque práctico y acciones concretas.',
        'Si falta contexto, indícalo y pide el dato mínimo necesario.',
        'Cuando haya imágenes adjuntas, analízalas de forma explícita y responde sobre su contenido visual.'
    ];

    const normalizedSummary = truncateText(String(summary || ''), THREAD_SUMMARY_MAX_CHARS);
    if (normalizedSummary) {
        lines.push(
            '',
            'Memoria conversacional resumida (úsala como contexto durable, sin repetirla textual):',
            normalizedSummary
        );
    }

    return lines.join('\n');
}

function buildCurrentUserPrompt(message, context, imagesCount) {
    const lines = [String(message || '').trim()];
    if (Number(imagesCount || 0) > 0) {
        lines.push('', `Hay ${imagesCount} imagen(es) adjunta(s) en esta consulta. Debes analizarlas antes de responder.`);
    }

    const contextLines = [];
    if (context.pageTitle) contextLines.push(`Página: ${context.pageTitle}`);
    if (context.courseId) contextLines.push(`Curso: ${context.courseId}`);
    if (context.topicId) contextLines.push(`Tema: ${context.topicId}`);
    if (context.selection) contextLines.push(`Selección:\n${context.selection}`);
    if (context.surroundingContext) contextLines.push(`Contexto cercano:\n${context.surroundingContext}`);

    if (contextLines.length) {
        lines.push('', 'Contexto de la consulta actual:', contextLines.join('\n\n'));
    }

    return lines.join('\n').trim();
}

function buildInputFromThread({ thread, context, images }) {
    const turns = thread.turns.slice(-THREAD_WINDOW_TURNS);
    const currentPrompt = buildCurrentUserPrompt(turns[turns.length - 1].content, context, images.length);

    return turns.map((turn, index) => {
        const role = turn.role === 'assistant' ? 'assistant' : 'user';
        const isCurrentUserTurn = index === turns.length - 1 && role === 'user';

        if (!isCurrentUserTurn) {
            const contentType = role === 'assistant' ? 'output_text' : 'input_text';
            return {
                role,
                content: [{ type: contentType, text: turn.content }]
            };
        }

        const content = [{ type: 'input_text', text: currentPrompt }];
        images.forEach((img) => {
            content.push({
                type: 'input_image',
                image_url: `data:${img.type};base64,${img.data}`
            });
        });

        return {
            role: 'user',
            content
        };
    });
}

function pickSummaryModel(mainModel) {
    if (AVAILABLE_MODELS.includes(SUMMARY_MODEL_PREFERRED)) return SUMMARY_MODEL_PREFERRED;
    if (AVAILABLE_MODELS.includes('gpt-4o-mini')) return 'gpt-4o-mini';
    if (AVAILABLE_MODELS.includes(mainModel)) return mainModel;
    return DEFAULT_MODEL;
}

function supportsVisionModel(model) {
    const normalized = String(model || '').trim();
    if (!normalized) return false;
    return VISION_MODELS.some((pattern) => modelMatchesPattern(normalized, pattern));
}

function modelMatchesPattern(model, pattern) {
    const normalizedPattern = String(pattern || '').trim();
    if (!normalizedPattern) return false;
    if (normalizedPattern.endsWith('*')) {
        return model.startsWith(normalizedPattern.slice(0, -1));
    }
    return model === normalizedPattern;
}

function buildSummaryInput(summary, turns) {
    const lines = [
        'Resumen previo (si existe):',
        summary ? summary : '(vacío)',
        '',
        'Fragmentos antiguos a comprimir:',
        turns.map((turn) => `- ${turn.role === 'assistant' ? 'assistant' : 'user'}: ${truncateText(turn.content, 260)}`).join('\n'),
        '',
        'Genera una memoria durable en español, compacta, SOLO con estos apartados y en bullets:',
        'Contexto',
        'Decisiones/Conclusiones',
        'Dudas abiertas',
        'Datos importantes (IDs, rutas, números)'
    ];

    return lines.join('\n');
}

function normalizeSummaryText(value) {
    return truncateText(String(value || '').replace(/\s+$/g, ''), THREAD_SUMMARY_MAX_CHARS);
}

function buildFallbackSummary(previousSummary, turns) {
    const compactTurns = turns.slice(-8).map((turn) => {
        const role = turn.role === 'assistant' ? 'Asistente' : 'Usuario';
        return `- ${role}: ${truncateText(turn.content, 140)}`;
    });

    const sections = [
        'Contexto',
        previousSummary ? `- ${truncateText(previousSummary, 280)}` : '- Conversación técnica sobre el curso.',
        '',
        'Decisiones/Conclusiones',
        '- Se mantiene continuidad con el hilo anterior.',
        '',
        'Dudas abiertas',
        '- Revisar puntos pendientes en próximos turnos.',
        '',
        'Datos importantes (IDs, rutas, números)',
        compactTurns.length ? compactTurns.join('\n') : '- Sin datos adicionales.'
    ];

    return truncateText(sections.join('\n'), THREAD_SUMMARY_MAX_CHARS);
}

async function maybeRefreshThreadSummary({ thread, model }) {
    if (!thread || thread.turns.length <= MAX_TURNS_BEFORE_SUMMARY) {
        return { summarized: false, usage: emptyUsage(), warning: null, model: pickSummaryModel(model) };
    }

    const turnsToCompressCount = Math.max(0, thread.turns.length - THREAD_WINDOW_TURNS);
    if (turnsToCompressCount <= 0) {
        return { summarized: false, usage: emptyUsage(), warning: null, model: pickSummaryModel(model) };
    }

    const turnsToCompress = thread.turns.slice(0, turnsToCompressCount);
    const summaryModel = pickSummaryModel(model);

    try {
        const completion = await callOpenAISummary({
            model: summaryModel,
            summary: thread.summary,
            turns: turnsToCompress
        });
        const usage = normalizeUsage(completion);
        const summaryText = normalizeSummaryText(extractResponseText(completion));
        thread.summary = summaryText || buildFallbackSummary(thread.summary, turnsToCompress);
        thread.turns = thread.turns.slice(-THREAD_WINDOW_TURNS);
        touchThread(thread);
        return { summarized: true, usage, warning: null, model: summaryModel };
    } catch (_error) {
        thread.summary = buildFallbackSummary(thread.summary, turnsToCompress);
        thread.turns = thread.turns.slice(-THREAD_WINDOW_TURNS);
        touchThread(thread);
        return {
            summarized: true,
            usage: emptyUsage(),
            warning: 'No se pudo actualizar el resumen con IA. Se aplicó un resumen local de respaldo.',
            model: summaryModel
        };
    }
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

async function callResponsesApi({ model, maxOutputTokens, instructions, input }) {
    const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model,
            max_output_tokens: maxOutputTokens,
            instructions,
            input
        })
    });

    const json = await response.json();
    if (!response.ok) {
        const detail = json && json.error && json.error.message ? json.error.message : `HTTP ${response.status}`;
        throw new Error(`Error de OpenAI: ${detail}`);
    }

    return json;
}

async function callOpenAIQuery({ model, maxTokens, thread, context, images }) {
    const input = buildInputFromThread({ thread, context, images });
    return callResponsesApi({
        model,
        maxOutputTokens: maxTokens,
        instructions: buildAssistantInstructions(thread.summary),
        input
    });
}

async function callOpenAISummary({ model, summary, turns }) {
    const prompt = buildSummaryInput(summary, turns);
    return callResponsesApi({
        model,
        maxOutputTokens: SUMMARY_MAX_TOKENS,
        instructions: [
            'Eres un sistema de memoria conversacional.',
            'Devuelve solo un resumen compacto en español con bullets.',
            'No inventes datos no presentes.'
        ].join('\n'),
        input: [
            {
                role: 'user',
                content: [{ type: 'input_text', text: prompt }]
            }
        ]
    });
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

function emptyUsage() {
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

function addUsage(a, b) {
    const left = a || emptyUsage();
    const right = b || emptyUsage();
    return {
        inputTokens: Number(left.inputTokens || 0) + Number(right.inputTokens || 0),
        outputTokens: Number(left.outputTokens || 0) + Number(right.outputTokens || 0),
        totalTokens: Number(left.totalTokens || 0) + Number(right.totalTokens || 0)
    };
}

function estimateCost(model, inputTokens, outputTokens) {
    const price = PRICE_PER_1K[model] || PRICE_PER_1K['gpt-4o-mini'];
    const inputCost = (Number(inputTokens || 0) / 1000) * Number(price.input || 0);
    const outputCost = (Number(outputTokens || 0) / 1000) * Number(price.output || 0);
    return Number((inputCost + outputCost).toFixed(8));
}

function toInt(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const rounded = Math.round(parsed);
    return Math.max(min, Math.min(max, rounded));
}

function truncateText(value, maxLen) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    if (!maxLen || text.length <= maxLen) return text;
    return text.slice(0, Math.max(1, maxLen - 1)).trim() + '…';
}

function sanitizeThreadId(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const normalized = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120);
    return normalized.length >= 8 ? normalized : '';
}

function createThreadId() {
    if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `thr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createEmptyThread(threadId) {
    return {
        threadId,
        summary: '',
        turns: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

function touchThread(thread) {
    thread.updatedAt = new Date().toISOString();
}

function normalizeTurn(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const role = raw.role === 'assistant' ? 'assistant' : 'user';
    const content = truncateText(raw.content || raw.text || '', THREAD_TURN_MAX_CHARS);
    if (!content) return null;
    const ts = String(raw.ts || raw.at || new Date().toISOString());
    return { role, content, ts };
}

function normalizeThread(raw, threadId) {
    const parsed = raw && typeof raw === 'object' ? raw : {};
    const turnsRaw = Array.isArray(parsed.turns)
        ? parsed.turns
        : Array.isArray(parsed.messages)
            ? parsed.messages
            : [];

    const turns = turnsRaw
        .map(normalizeTurn)
        .filter(Boolean)
        .slice(-THREAD_HARD_LIMIT);

    return {
        threadId,
        summary: truncateText(parsed.summary || parsed.conversation_summary || '', THREAD_SUMMARY_MAX_CHARS),
        turns,
        createdAt: String(parsed.createdAt || parsed.created_at || new Date().toISOString()),
        updatedAt: String(parsed.updatedAt || parsed.updated_at || new Date().toISOString())
    };
}

function ensureThreadsDir() {
    try {
        fs.mkdirSync(THREADS_DIR, { recursive: true });
    } catch (_err) {
    }
}

function threadFilePath(threadId) {
    return path.join(THREADS_DIR, `${threadId}.json`);
}

function readThreadFromDisk(threadId) {
    ensureThreadsDir();
    const filePath = threadFilePath(threadId);

    try {
        if (!fs.existsSync(filePath)) {
            return createEmptyThread(threadId);
        }

        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return normalizeThread(parsed, threadId);
    } catch (_err) {
        try {
            if (fs.existsSync(filePath)) {
                const backupPath = `${filePath}.corrupt-${Date.now()}`;
                fs.renameSync(filePath, backupPath);
            }
        } catch (_backupErr) {
        }
        return createEmptyThread(threadId);
    }
}

function getThreadState(threadId) {
    if (!threadStore[threadId]) {
        evictOldThreads();
        threadStore[threadId] = readThreadFromDisk(threadId);
    }
    return threadStore[threadId];
}

function persistThreadState(threadId) {
    const thread = threadStore[threadId];
    if (!thread) return;

    ensureThreadsDir();
    touchThread(thread);

    const filePath = threadFilePath(threadId);
    const tmpPath = `${filePath}.tmp`;

    const payload = {
        threadId,
        summary: thread.summary,
        turns: thread.turns,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt
    };

    try {
        fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2));
        fs.renameSync(tmpPath, filePath);
    } catch (_err) {
        try {
            if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        } catch (_unlinkErr) {
        }
    }
}

function appendTurn(thread, role, content) {
    const normalized = normalizeTurn({ role, content, ts: new Date().toISOString() });
    if (!normalized) return;

    thread.turns.push(normalized);
    if (thread.turns.length > THREAD_HARD_LIMIT) {
        thread.turns = thread.turns.slice(-THREAD_HARD_LIMIT);
    }
    touchThread(thread);
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
