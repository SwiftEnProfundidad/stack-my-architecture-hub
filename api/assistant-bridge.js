const OPENAI_BASE_URL = String(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const ANTHROPIC_BASE_URL = String(process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1').replace(/\/$/, '');
const GEMINI_BASE_URL = String(process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
const ANTHROPIC_VERSION = String(process.env.ANTHROPIC_VERSION || '2023-06-01').trim();

const QUERY_PATH = '/assistant/query';
const SUPPORTED_PROVIDERS = ['openai', 'anthropic', 'gemini'];
const DEFAULT_PROVIDER = 'openai';
const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const DEFAULT_MAX_TOKENS = toInt(process.env.ASSISTANT_MAX_TOKENS_DEFAULT, 600, 100, 8192);
const MAX_TOKENS_CAP = toInt(process.env.ASSISTANT_MAX_TOKENS_CAP, 1200, 100, 8192);
const DAILY_WARNING_USD = toFloat(process.env.ASSISTANT_DAILY_WARNING_USD, 0.25, 0);
const DEFAULT_DAILY_BUDGET_USD = toFloat(process.env.ASSISTANT_SOFT_DAILY_BUDGET_USD, 2, 0);

const DEFAULT_ALLOWED_MODELS = {
  openai: ['gpt-4.1-mini', 'gpt-4o-mini'],
  anthropic: ['claude-3-5-haiku-latest', 'claude-3-7-sonnet-latest'],
  gemini: ['gemini-2.0-flash', 'gemini-2.0-flash-lite']
};

const DEFAULT_VISION_PATTERNS = {
  openai: ['gpt-4.1*', 'gpt-4o*', 'gpt-5*'],
  anthropic: ['claude-3*'],
  gemini: ['gemini-*']
};

const DEFAULT_VISION_FALLBACK_MODEL = {
  openai: String(process.env.OPENAI_VISION_FALLBACK_MODEL || 'gpt-4.1-mini').trim(),
  anthropic: String(process.env.ANTHROPIC_VISION_FALLBACK_MODEL || 'claude-3-5-haiku-latest').trim(),
  gemini: String(process.env.GEMINI_VISION_FALLBACK_MODEL || 'gemini-2.0-flash').trim()
};

const PRICES_PER_1K = {
  openai: {
    'gpt-4.1-mini': { input: 0.0004, output: 0.0016 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-5': { input: 0.00125, output: 0.01 },
    'gpt-5-mini': { input: 0.00025, output: 0.002 },
    'gpt-5-nano': { input: 0.00005, output: 0.0004 }
  },
  anthropic: {
    'claude-3-5-haiku-latest': { input: 0.0008, output: 0.004 },
    'claude-3-7-sonnet-latest': { input: 0.003, output: 0.015 }
  },
  gemini: {
    'gemini-2.0-flash': { input: 0.0001, output: 0.0004 },
    'gemini-2.0-flash-lite': { input: 0.00005, output: 0.0002 }
  }
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
      query_path: QUERY_PATH,
      byok_required: true
    });
    return;
  }

  if (route === 'config' && req.method === 'GET') {
    const providers = buildProvidersConfig();
    const openAiProvider = providers.find((item) => item.id === DEFAULT_PROVIDER) || providers[0];
    sendJson(res, 200, {
      ok: true,
      schemaVersion: 2,
      byok_required: true,
      default_provider: DEFAULT_PROVIDER,
      providers,
      models: openAiProvider.models,
      default_model: openAiProvider.default_model,
      max_tokens_default: DEFAULT_MAX_TOKENS,
      max_tokens_cap: MAX_TOKENS_CAP,
      soft_daily_budget_usd: runtimeState.softDailyBudgetUsd,
      daily_warning_usd: DAILY_WARNING_USD,
      max_images: MAX_IMAGES,
      max_image_bytes: MAX_IMAGE_BYTES,
      vision_models: getVisionModelPatterns(DEFAULT_PROVIDER),
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
  const body = await readJsonBody(req);

  const question = readQuestion(body);
  if (!question) {
    sendJson(res, 400, {
      ok: false,
      error: 'El campo message, prompt o question es obligatorio.'
    });
    return;
  }

  const provider = readProvider(body);
  if (!provider) {
    sendJson(res, 400, {
      ok: false,
      error: 'Proveedor inválido. Usa openai, anthropic o gemini.'
    });
    return;
  }

  const apiKey = readUserApiKey(req, body);
  if (!apiKey) {
    sendJson(res, 400, {
      ok: false,
      error: 'Falta la API key del usuario para el proveedor seleccionado.'
    });
    return;
  }

  const allowedModels = getAllowedModels(provider);
  const selectedModel = allowedModels.includes(String(body.model || '').trim())
    ? String(body.model || '').trim()
    : pickDefaultModel(provider, allowedModels);

  const images = normalizeImages(body.images);
  if (images.error) {
    sendJson(res, 400, { ok: false, error: images.error });
    return;
  }

  const hasImages = images.value.length > 0;
  let model = selectedModel;
  let warning = '';
  if (hasImages && !supportsVisionModel(provider, model)) {
    model = pickVisionFallbackModel(provider, allowedModels);
    warning = 'El modelo seleccionado no soporta visión. Se aplicó fallback automático.';
  }

  const maxTokens = clampInt(body.maxTokens, DEFAULT_MAX_TOKENS, 100, MAX_TOKENS_CAP);
  const prompt = buildPrompt(body, question);

  try {
    const providerResult = await queryProvider({
      provider,
      apiKey,
      model,
      maxTokens,
      prompt,
      images: images.value
    });

    const usage = providerResult.usage || emptyUsage();
    const estimatedCostUsd = estimateCostUsd(provider, model, usage.inputTokens, usage.outputTokens);

    runtimeState.totalRequests += 1;
    runtimeState.totalTokens += usage.totalTokens;
    runtimeState.totalEstimatedCostUsd += estimatedCostUsd;
    runtimeState.daily.requests += 1;
    runtimeState.daily.totalTokens += usage.totalTokens;
    runtimeState.daily.estimatedCostUsd += estimatedCostUsd;
    runtimeState.daily.imagesCount += images.value.length;

    sendJson(res, 200, {
      ok: true,
      provider,
      answer: providerResult.answer,
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
    const statusCode = toInt(error && error.statusCode, 500, 400, 599);
    const message = error && error.message ? error.message : 'Error desconocido al consultar el proveedor.';
    sendJson(res, statusCode, { ok: false, error: message });
  }
}

async function queryProvider({ provider, apiKey, model, maxTokens, prompt, images }) {
  if (provider === 'openai') {
    return queryOpenAi({ apiKey, model, maxTokens, prompt, images });
  }

  if (provider === 'anthropic') {
    return queryAnthropic({ apiKey, model, maxTokens, prompt, images });
  }

  if (provider === 'gemini') {
    return queryGemini({ apiKey, model, maxTokens, prompt, images });
  }

  throw createProviderError(400, 'Proveedor no soportado.');
}

async function queryOpenAi({ apiKey, model, maxTokens, prompt, images }) {
  const content = [{ type: 'input_text', text: prompt }];

  images.forEach((item) => {
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

  const response = await fetch(OPENAI_BASE_URL + '/responses', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  const json = parseJson(text);
  if (!response.ok) {
    throw createProviderError(response.status, readProviderErrorMessage(json, response.status));
  }

  return {
    answer: readOpenAiAnswer(json),
    usage: readOpenAiUsage(json)
  };
}

async function queryAnthropic({ apiKey, model, maxTokens, prompt, images }) {
  const content = [{ type: 'text', text: prompt }];

  images.forEach((item) => {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: item.type,
        data: item.data
      }
    });
  });

  const payload = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content }]
  };

  const response = await fetch(ANTHROPIC_BASE_URL + '/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  const json = parseJson(text);
  if (!response.ok) {
    throw createProviderError(response.status, readProviderErrorMessage(json, response.status));
  }

  return {
    answer: readAnthropicAnswer(json),
    usage: readAnthropicUsage(json)
  };
}

async function queryGemini({ apiKey, model, maxTokens, prompt, images }) {
  const parts = [{ text: prompt }];

  images.forEach((item) => {
    parts.push({
      inline_data: {
        mime_type: item.type,
        data: item.data
      }
    });
  });

  const payload = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      maxOutputTokens: maxTokens
    }
  };

  const url = GEMINI_BASE_URL
    + '/models/'
    + encodeURIComponent(model)
    + ':generateContent?key='
    + encodeURIComponent(apiKey);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  const json = parseJson(text);
  if (!response.ok) {
    throw createProviderError(response.status, readProviderErrorMessage(json, response.status));
  }

  return {
    answer: readGeminiAnswer(json),
    usage: readGeminiUsage(json)
  };
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
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

function readProvider(body) {
  const value = String(body.provider || body.providerId || body.vendor || DEFAULT_PROVIDER).trim().toLowerCase();
  if (!SUPPORTED_PROVIDERS.includes(value)) return '';
  return value;
}

function readUserApiKey(req, body) {
  const bodyKey = String(
    body.apiKey
    || body.api_key
    || body.userApiKey
    || body.user_api_key
    || ''
  ).trim();
  if (bodyKey) return bodyKey;

  const headers = req && req.headers && typeof req.headers === 'object' ? req.headers : {};
  const headerKey = String(headers['x-api-key'] || headers['X-API-Key'] || '').trim();
  if (headerKey) return headerKey;

  const authHeader = String(headers.authorization || headers.Authorization || '').trim();
  if (/^Bearer\s+/i.test(authHeader)) {
    return authHeader.replace(/^Bearer\s+/i, '').trim();
  }

  return '';
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

function buildProvidersConfig() {
  return SUPPORTED_PROVIDERS.map((provider) => {
    const models = getAllowedModels(provider);
    return {
      id: provider,
      label: providerLabel(provider),
      models,
      default_model: pickDefaultModel(provider, models),
      vision_models: getVisionModelPatterns(provider),
      max_images: MAX_IMAGES,
      max_image_bytes: MAX_IMAGE_BYTES,
      byok_required: true
    };
  });
}

function providerLabel(provider) {
  if (provider === 'openai') return 'OpenAI';
  if (provider === 'anthropic') return 'Anthropic';
  if (provider === 'gemini') return 'Google Gemini';
  return provider;
}

function getAllowedModels(provider) {
  const envName = provider === 'openai'
    ? 'OPENAI_ALLOWED_MODELS'
    : provider === 'anthropic'
      ? 'ANTHROPIC_ALLOWED_MODELS'
      : 'GEMINI_ALLOWED_MODELS';

  const fromEnv = String(process.env[envName] || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return fromEnv.length ? fromEnv : DEFAULT_ALLOWED_MODELS[provider];
}

function getVisionModelPatterns(provider) {
  const envName = provider === 'openai'
    ? 'OPENAI_VISION_MODELS'
    : provider === 'anthropic'
      ? 'ANTHROPIC_VISION_MODELS'
      : 'GEMINI_VISION_MODELS';

  const fromEnv = String(process.env[envName] || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return fromEnv.length ? fromEnv : DEFAULT_VISION_PATTERNS[provider];
}

function pickDefaultModel(provider, allowedModels) {
  const envName = provider === 'openai'
    ? 'OPENAI_MODEL_DEFAULT'
    : provider === 'anthropic'
      ? 'ANTHROPIC_MODEL_DEFAULT'
      : 'GEMINI_MODEL_DEFAULT';

  const requested = String(process.env[envName] || '').trim();
  if (requested && allowedModels.includes(requested)) return requested;
  return allowedModels[0] || DEFAULT_ALLOWED_MODELS[provider][0];
}

function pickVisionFallbackModel(provider, allowedModels) {
  const requested = String(DEFAULT_VISION_FALLBACK_MODEL[provider] || '').trim();
  if (requested && allowedModels.includes(requested)) return requested;
  return pickDefaultModel(provider, allowedModels);
}

function supportsVisionModel(provider, model) {
  const value = String(model || '').trim();
  const patterns = getVisionModelPatterns(provider);
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

function readOpenAiAnswer(json) {
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

function readAnthropicAnswer(json) {
  const content = Array.isArray(json && json.content) ? json.content : [];
  const chunks = content
    .map((item) => {
      if (!item || item.type !== 'text') return '';
      return String(item.text || '').trim();
    })
    .filter(Boolean);

  if (chunks.length) return chunks.join('\n\n');
  return 'No se recibió contenido de respuesta.';
}

function readGeminiAnswer(json) {
  const candidates = Array.isArray(json && json.candidates) ? json.candidates : [];
  const chunks = [];

  candidates.forEach((candidate) => {
    const parts = Array.isArray(candidate && candidate.content && candidate.content.parts)
      ? candidate.content.parts
      : [];

    parts.forEach((part) => {
      const text = String(part && part.text || '').trim();
      if (text) chunks.push(text);
    });
  });

  if (chunks.length) return chunks.join('\n\n');
  return 'No se recibió contenido de respuesta.';
}

function readOpenAiUsage(json) {
  const usage = json && json.usage && typeof json.usage === 'object' ? json.usage : {};
  const inputTokens = toInt(usage.input_tokens, 0, 0);
  const outputTokens = toInt(usage.output_tokens, 0, 0);
  const totalTokens = toInt(usage.total_tokens, inputTokens + outputTokens, 0);
  return { inputTokens, outputTokens, totalTokens };
}

function readAnthropicUsage(json) {
  const usage = json && json.usage && typeof json.usage === 'object' ? json.usage : {};
  const inputTokens = toInt(usage.input_tokens, 0, 0);
  const outputTokens = toInt(usage.output_tokens, 0, 0);
  const totalTokens = toInt(usage.total_tokens, inputTokens + outputTokens, 0);
  return { inputTokens, outputTokens, totalTokens };
}

function readGeminiUsage(json) {
  const usage = json && json.usageMetadata && typeof json.usageMetadata === 'object' ? json.usageMetadata : {};
  const inputTokens = toInt(usage.promptTokenCount, 0, 0);
  const outputTokens = toInt(usage.candidatesTokenCount, 0, 0);
  const totalTokens = toInt(usage.totalTokenCount, inputTokens + outputTokens, 0);
  return { inputTokens, outputTokens, totalTokens };
}

function readProviderErrorMessage(json, statusCode) {
  if (json && json.error && typeof json.error.message === 'string' && json.error.message.trim()) {
    return json.error.message.trim();
  }

  if (json && typeof json.error === 'string' && json.error.trim()) {
    return json.error.trim();
  }

  if (json && typeof json.message === 'string' && json.message.trim()) {
    return json.message.trim();
  }

  return 'HTTP ' + statusCode;
}

function createProviderError(statusCode, message) {
  const error = new Error(String(message || 'Error de proveedor.'));
  error.statusCode = toInt(statusCode, 500, 400, 599);
  return error;
}

function emptyUsage() {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0
  };
}

function estimateCostUsd(provider, model, inputTokens, outputTokens) {
  const providerPrices = PRICES_PER_1K[provider] || {};
  const price = providerPrices[model] || { input: 0, output: 0 };
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
