const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const HANDLER_PATH = path.resolve(__dirname, '../../api/assistant-bridge.js');

function loadHandler(envOverrides = {}) {
  const previous = {};
  const keys = Object.keys(envOverrides);

  keys.forEach((key) => {
    previous[key] = process.env[key];
    const value = envOverrides[key];
    if (value === undefined || value === null) {
      delete process.env[key];
      return;
    }
    process.env[key] = String(value);
  });

  delete require.cache[require.resolve(HANDLER_PATH)];
  const handler = require(HANDLER_PATH);

  keys.forEach((key) => {
    if (previous[key] === undefined) {
      delete process.env[key];
      return;
    }
    process.env[key] = previous[key];
  });

  return handler;
}

async function invoke(handler, { method = 'GET', url = '/config?route=config', body, headers } = {}) {
  const req = {
    method,
    url,
    body,
    headers: headers || {}
  };

  return await new Promise((resolve, reject) => {
    const responseHeaders = {};
    const res = {
      statusCode: 200,
      setHeader(name, value) {
        responseHeaders[String(name).toLowerCase()] = String(value);
      },
      status(code) {
        this.statusCode = Number(code);
        return this;
      },
      end(payload = '') {
        const rawBody = String(payload || '');
        let json = null;
        try {
          json = JSON.parse(rawBody);
        } catch (_error) {
          json = null;
        }

        resolve({
          statusCode: this.statusCode,
          headers: responseHeaders,
          rawBody,
          json
        });
      }
    };

    Promise.resolve(handler(req, res)).catch(reject);
  });
}

async function withMockFetch(mockFetch, fn) {
  const originalFetch = global.fetch;
  global.fetch = mockFetch;
  try {
    return await fn();
  } finally {
    global.fetch = originalFetch;
  }
}

test('GET /config expone providers BYOK', async () => {
  const handler = loadHandler({
    OPENAI_ALLOWED_MODELS: 'gpt-4.1-mini',
    ANTHROPIC_ALLOWED_MODELS: 'claude-3-5-haiku-latest',
    GEMINI_ALLOWED_MODELS: 'gemini-2.0-flash'
  });

  const result = await invoke(handler, {
    method: 'GET',
    url: '/config?route=config'
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.json.ok, true);
  assert.equal(result.json.byok_required, true);
  assert.equal(result.json.default_provider, 'openai');
  assert.deepEqual(
    result.json.providers.map((item) => item.id),
    ['openai', 'anthropic', 'gemini']
  );
});

test('POST /assistant/query falla si no llega apiKey de usuario', async () => {
  const handler = loadHandler({ OPENAI_API_KEY: undefined });

  const result = await invoke(handler, {
    method: 'POST',
    url: '/assistant/query?route=assistant-query',
    body: {
      provider: 'openai',
      question: 'Hola'
    }
  });

  assert.equal(result.statusCode, 400);
  assert.match(String(result.json.error || ''), /api key/i);
});

test('POST /assistant/query usa OpenAI con API key del usuario', async () => {
  const fetchCalls = [];
  const handler = loadHandler({
    OPENAI_ALLOWED_MODELS: 'gpt-4.1-mini,gpt-4o-mini',
    OPENAI_MODEL_DEFAULT: 'gpt-4.1-mini'
  });

  await withMockFetch(async (url, options) => {
    fetchCalls.push({ url, options });
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        output_text: 'Respuesta OpenAI',
        usage: {
          input_tokens: 12,
          output_tokens: 6,
          total_tokens: 18
        }
      })
    };
  }, async () => {
    const result = await invoke(handler, {
      method: 'POST',
      url: '/assistant/query?route=assistant-query',
      body: {
        provider: 'openai',
        apiKey: 'sk-user-openai',
        question: 'Explica Clean Architecture',
        model: 'gpt-4.1-mini'
      }
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.json.ok, true);
    assert.equal(result.json.provider, 'openai');
    assert.equal(result.json.answer, 'Respuesta OpenAI');
  });

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, 'https://api.openai.com/v1/responses');
  assert.equal(fetchCalls[0].options.headers.Authorization, 'Bearer sk-user-openai');
});

test('POST /assistant/query usa Anthropic con API key del usuario', async () => {
  const fetchCalls = [];
  const handler = loadHandler({
    ANTHROPIC_ALLOWED_MODELS: 'claude-3-5-haiku-latest',
    ANTHROPIC_MODEL_DEFAULT: 'claude-3-5-haiku-latest'
  });

  await withMockFetch(async (url, options) => {
    fetchCalls.push({ url, options });
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        content: [{ type: 'text', text: 'Respuesta Claude' }],
        usage: {
          input_tokens: 11,
          output_tokens: 7
        }
      })
    };
  }, async () => {
    const result = await invoke(handler, {
      method: 'POST',
      url: '/assistant/query?route=assistant-query',
      body: {
        provider: 'anthropic',
        apiKey: 'sk-ant-user',
        question: 'Resume SOLID',
        model: 'claude-3-5-haiku-latest'
      }
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.json.ok, true);
    assert.equal(result.json.provider, 'anthropic');
    assert.equal(result.json.answer, 'Respuesta Claude');
  });

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, 'https://api.anthropic.com/v1/messages');
  assert.equal(fetchCalls[0].options.headers['x-api-key'], 'sk-ant-user');
});

test('POST /assistant/query usa Gemini con API key del usuario', async () => {
  const fetchCalls = [];
  const handler = loadHandler({
    GEMINI_ALLOWED_MODELS: 'gemini-2.0-flash',
    GEMINI_MODEL_DEFAULT: 'gemini-2.0-flash'
  });

  await withMockFetch(async (url, options) => {
    fetchCalls.push({ url, options });
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: 'Respuesta Gemini' }]
            }
          }
        ],
        usageMetadata: {
          promptTokenCount: 9,
          candidatesTokenCount: 5,
          totalTokenCount: 14
        }
      })
    };
  }, async () => {
    const result = await invoke(handler, {
      method: 'POST',
      url: '/assistant/query?route=assistant-query',
      body: {
        provider: 'gemini',
        apiKey: 'gem-user-key',
        question: 'Diferencia DDD y Clean',
        model: 'gemini-2.0-flash'
      }
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.json.ok, true);
    assert.equal(result.json.provider, 'gemini');
    assert.equal(result.json.answer, 'Respuesta Gemini');
  });

  assert.equal(fetchCalls.length, 1);
  assert.match(fetchCalls[0].url, /generativelanguage\.googleapis\.com/);
  assert.match(fetchCalls[0].url, /key=gem-user-key/);
});
