const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || '').trim();
const OPENAI_BASE_URL = String(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');

const QUERY_PATH = '/assistant/query';
const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const DEFAULT_MAX_TOKENS = toInt(process.env.ASSISTANT_MAX_TOKENS_DEFAULT, 600, 100, 8192);
const MAX_TOKENS_CAP = toInt(process.env.ASSISTANT_MAX_TOKENS_CAP, 1200, 100, 8192);
const DAILY_WARNING_USD = toFloat(process.env.ASSISTANT_DAILY_WARNING_USD, 0.25, 0);
const DEFAULT_DAILY_BUDGET_USD = toFloat(process.env.ASSISTANT_SOFT_DAILY_BUDGET_USD, 2, 0);

const DEFAULT_ALLOWED_MODELS = ['gpt-4.1-mini', 'gpt-4o-mini'];
const DEFAULT_VISION_PATTERNS = ['gpt-4.1*', 'gpt-4o*', 'gpt-5*'];
const VISION_FALLBACK_MODEL = String(process.env.OPENAI_VISION_FALLBACK_MODEL || 'gpt-4.1-mini').trim();

const PRICES_PER_1K = {
  'gpt-4.1-mini': { input: 0.0004, output: 0.0016 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-5': { input: 0.00125, output: 0.01 },
  'gpt-5-mini': { input: 0.00025, output: 0.002 },
  'gpt-5-nano': { input: 0.00005, output: 0.0004 }
};

const runtimeState = {
  softDailyBudgetUsd: DEFAULT_DAILY_BUDGET_USD,
  totalRequests: 0,
  totalTokens: 0,
  totalEstimatedCostUsd: 0,
  daily: {
    key: dayKey(),
    requests: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
    imagesCount: 0
  }
};

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const route = resolveRoute(req);
  rollDailyWindow();

  if (route === 'health' && req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      service: 'assistant-bridge-vercel',
      query_path: QUERY_PATH
    });
    return;
  }

  if (route === 'config' && req.method === 'GET') {
    const allowedModels = getAllowedModels();
    const defaultModel = pickDefaultModel(allowedModels);
    sendJson(res, 200, {
      ok: true,
      schemaVersion: 1,
      models: allowedModels,
      default_model: defaultModel,
      max_tokens_default: DEFAULT_MAX_TOKENS,
      max_tokens_cap: MAX_TOKENS_CAP,
      soft_daily_budget_usd: runtimeState.softDailyBudgetUsd,
      daily_warning_usd: DAILY_WARNING_USD,
      max_images: MAX_IMAGES,
      max_image_bytes: MAX_IMAGE_BYTES,
      vision_models: getVisionModelPatterns(),
      query_path: QUERY_PATH
    });
    return;
  }

  if (route === 'config-runtime' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const budget = toFloat(body.softDailyBudgetUsd ?? body.soft_daily_budget_usd, runtimeState.softDailyBudgetUsd, 0);
    runtimeState.softDailyBudgetUsd = budget;
    sendJson(res, 200, {
      ok: true,
      soft_daily_budget_usd: runtimeState.softDailyBudgetUsd
    });
    return;
  }

  if (route === 'metrics' && req.method === 'GET') {
    sendJson(res, 200, metricsPayload());
    return;
  }

  if (route === 'assistant-query' && req.method === 'POST') {
    await handleAssistantQuery(req, res);
    return;
  }

  sendJson(res, 404, {
    ok: false,
    error: 'Ruta no encontrada para assistant-bridge.'
  });
};

async function handleAssistantQuery(req, res) {
  if (!OPENAI_API_KEY) {
    sendJson(res, 503, {
      ok: false,
      error: 'OPENAI_API_KEY no está configurada en el deployment.'
    });
    return;
  }

  const body = await readJsonBody(req);
  const question = readQuestion(body);
  if (!question) {
    sendJson(res, 400, {
      ok: false,
      error: 'El campo message, prompt o question es obligatorio.'
    });
    return;
  }

  const allowedModels = getAllowedModels();
  const selectedModel = allowedModels.includes(String(body.model || '').trim())
    ? String(body.model || '').trim()
    : pickDefaultModel(allowedModels);

  const images = normalizeImages(body.images);
  if (images.error) {
    sendJson(res, 400, { ok: false, error: images.error });
    return;
  }

  const hasImages = images.value.length > 0;
  let model = selectedModel;
  let warning = '';
  if (hasImages && !supportsVisionModel(model)) {
    model = allowedModels.includes(VISION_FALLBACK_MODEL) ? VISION_FALLBACK_MODEL : pickDefaultModel(allowedModels);
    warning = 'El modelo seleccionado no soporta visión. Se aplicó fallback automático.';
  }

  const maxTokens = clampInt(body.maxTokens, DEFAULT_MAX_TOKENS, 100, MAX_TOKENS_CAP);
  const prompt = buildPrompt(body, question);
  const content = [{ type: 'input_text', text: prompt }];

  images.value.forEach((item) => {
    content.push({
      type: 'input_image',
      image_url: 'data:' + item.type + ';base64,' + item.data
    });
  });

  const payload = {
    model,
    input: [{ role: 'user', content }],
    max_output_tokens: maxTokens
  };

  try {
    const response = await fetch(OPENAI_BASE_URL + '/responses', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + OPENAI_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    const json = parseJson(text);
    if (!response.ok) {
      const apiError = json && json.error && json.error.message ? json.error.message : 'HTTP ' + response.status;
      sendJson(res, response.status, { ok: false, error: String(apiError) });
      return;
    }

    const answer = readAnswer(json);
    const usage = readUsage(json);
    const estimatedCostUsd = estimateCostUsd(model, usage.inputTokens, usage.outputTokens);

    runtimeState.totalRequests += 1;
    runtimeState.totalTokens += usage.totalTokens;
    runtimeState.totalEstimatedCostUsd += estimatedCostUsd;
    runtimeState.daily.requests += 1;
    runtimeState.daily.totalTokens += usage.totalTokens;
    runtimeState.daily.estimatedCostUsd += estimatedCostUsd;
    runtimeState.daily.imagesCount += images.value.length;

    sendJson(res, 200, {
      ok: true,
      answer,
      model,
      selectedModel,
      warning: warning || null,
      hasImages: hasImages,
      imagesCount: images.value.length,
      estimatedCostUsd,
      usage: {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        estimatedCostUsd,
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
        total_tokens: usage.totalTokens,
        estimated_cost_usd: estimatedCostUsd
      },
      metrics: metricsPayload()
    });
  } catch (error) {
    const message = error && error.message ? error.message : 'Error desconocido al consultar OpenAI.';
    sendJson(res, 500, { ok: false, error: message });
  }
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function resolveRoute(req) {
  const url = new URL(req.url, 'http://localhost');
  const queryRoute = String(url.searchParams.get('route') || '').trim().toLowerCase();
  if (queryRoute) return queryRoute;

  const path = String(url.pathname || '');
  if (path.endsWith('/health')) return 'health';
  if (path.endsWith('/config/runtime')) return 'config-runtime';
  if (path.endsWith('/config')) return 'config';
  if (path.endsWith('/metrics')) return 'metrics';
  if (path.endsWith('/assistant/query')) return 'assistant-query';
  if (path.endsWith('/ask')) return 'assistant-query';
  return '';
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return parseJson(req.body) || {};

  return await new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      resolve(parseJson(raw) || {});
    });
    req.on('error', () => {
      resolve({});
    });
  });
}

function parseJson(raw) {
  try {
    return JSON.parse(String(raw || ''));
  } catch (_error) {
    return null;
  }
}

function readQuestion(body) {
  const value = body.message || body.prompt || body.question || '';
  return String(value).trim();
}

function buildPrompt(body, question) {
  const context = body && typeof body.context === 'object' ? body.context : {};
  const chunks = [question];

  const courseId = String(body.courseId || context.courseId || '').trim();
  const topicId = String(body.topicId || context.topicId || '').trim();
  const selectedText = String(body.selectedText || context.selectedText || '').trim();
  const surroundingContext = String(body.surroundingContext || context.surroundingContext || '').trim();

  if (courseId) chunks.push('Course: ' + courseId);
  if (topicId) chunks.push('Topic: ' + topicId);
  if (selectedText) chunks.push('Selected text: ' + selectedText);
  if (surroundingContext) chunks.push('Surrounding context: ' + surroundingContext);

  if (body.memory && typeof body.memory === 'object') {
    const summary = String(body.memory.conversation_summary || '').trim();
    if (summary) chunks.push('Conversation summary: ' + summary);
  }

  return chunks.join('\n\n');
}

function normalizeImages(images) {
  const list = Array.isArray(images) ? images : [];
  if (list.length > MAX_IMAGES) {
    return { error: 'Solo se permiten hasta ' + MAX_IMAGES + ' imágenes por consulta.' };
  }

  const normalized = [];
  for (let index = 0; index < list.length; index += 1) {
    const item = list[index] || {};
    const type = String(item.type || '').toLowerCase();
    const data = String(item.data || '').replace(/\s+/g, '');
    if (!data) continue;
    if (!type.startsWith('image/')) {
      return { error: 'Formato de imagen inválido en el adjunto #' + (index + 1) + '.' };
    }
    const size = base64ByteLength(data);
    if (size > MAX_IMAGE_BYTES) {
      return { error: 'La imagen #' + (index + 1) + ' supera el límite de ' + MAX_IMAGE_BYTES + ' bytes.' };
    }
    normalized.push({ type, data, size });
  }

  return { value: normalized };
}

function base64ByteLength(base64) {
  if (!base64) return 0;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function getAllowedModels() {
  const fromEnv = String(process.env.OPENAI_ALLOWED_MODELS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return fromEnv.length ? fromEnv : DEFAULT_ALLOWED_MODELS;
}

function getVisionModelPatterns() {
  const fromEnv = String(process.env.OPENAI_VISION_MODELS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return fromEnv.length ? fromEnv : DEFAULT_VISION_PATTERNS;
}

function pickDefaultModel(allowedModels) {
  const requested = String(process.env.OPENAI_MODEL_DEFAULT || '').trim();
  if (requested && allowedModels.includes(requested)) return requested;
  return allowedModels[0] || 'gpt-4.1-mini';
}

function supportsVisionModel(model) {
  const value = String(model || '').trim();
  const patterns = getVisionModelPatterns();
  return patterns.some((pattern) => matchModelPattern(value, pattern));
}

function matchModelPattern(model, pattern) {
  const normalizedModel = String(model || '').trim();
  const normalizedPattern = String(pattern || '').trim();
  if (!normalizedModel || !normalizedPattern) return false;
  if (normalizedPattern.endsWith('*')) {
    return normalizedModel.startsWith(normalizedPattern.slice(0, -1));
  }
  return normalizedModel === normalizedPattern;
}

function readAnswer(json) {
  if (json && typeof json.output_text === 'string' && json.output_text.trim()) {
    return json.output_text.trim();
  }

  const output = Array.isArray(json && json.output) ? json.output : [];
  const chunks = [];

  output.forEach((item) => {
    const content = Array.isArray(item && item.content) ? item.content : [];
    content.forEach((entry) => {
      if (entry && entry.type === 'output_text' && typeof entry.text === 'string') {
        const text = entry.text.trim();
        if (text) chunks.push(text);
      }
    });
  });

  if (chunks.length) return chunks.join('\n\n');
  return 'No se recibió contenido de respuesta.';
}

function readUsage(json) {
  const usage = json && json.usage && typeof json.usage === 'object' ? json.usage : {};
  const inputTokens = toInt(usage.input_tokens, 0, 0);
  const outputTokens = toInt(usage.output_tokens, 0, 0);
  const totalTokens = toInt(usage.total_tokens, inputTokens + outputTokens, 0);
  return { inputTokens, outputTokens, totalTokens };
}

function estimateCostUsd(model, inputTokens, outputTokens) {
  const price = PRICES_PER_1K[model] || PRICES_PER_1K['gpt-4.1-mini'];
  const inputCost = (Math.max(0, inputTokens) / 1000) * price.input;
  const outputCost = (Math.max(0, outputTokens) / 1000) * price.output;
  return Number((inputCost + outputCost).toFixed(8));
}

function metricsPayload() {
  return {
    ok: true,
    total_requests: runtimeState.totalRequests,
    total_tokens: runtimeState.totalTokens,
    total_estimated_cost_usd: Number(runtimeState.totalEstimatedCostUsd.toFixed(8)),
    soft_daily_budget_usd: runtimeState.softDailyBudgetUsd,
    daily: {
      date: runtimeState.daily.key,
      requests: runtimeState.daily.requests,
      total_tokens: runtimeState.daily.totalTokens,
      estimated_cost_usd: Number(runtimeState.daily.estimatedCostUsd.toFixed(8)),
      images_count: runtimeState.daily.imagesCount
    }
  };
}

function rollDailyWindow() {
  const current = dayKey();
  if (runtimeState.daily.key === current) return;
  runtimeState.daily = {
    key: current,
    requests: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
    imagesCount: 0
  };
}

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

function toInt(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const lowerBound = typeof min === 'number' ? min : Number.NEGATIVE_INFINITY;
  const upperBound = typeof max === 'number' ? max : Number.POSITIVE_INFINITY;
  if (parsed < lowerBound || parsed > upperBound) return fallback;
  return Math.round(parsed);
}

function toFloat(value, fallback, min) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (typeof min === 'number' && parsed < min) return fallback;
  return Math.round(parsed * 100) / 100;
}

function clampInt(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}
