const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const HANDLER_PATH = path.resolve(__dirname, '../../api/auth-sync.js');

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

async function invoke(handler, { method = 'GET', url = '/auth/config?route=config', body, headers } = {}) {
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

test('GET /auth/config reporta disabled sin env de Supabase Auth', async () => {
  const handler = loadHandler({
    SUPABASE_URL: undefined,
    SUPABASE_ANON_KEY: undefined
  });

  const result = await invoke(handler, {
    method: 'GET',
    url: '/auth/config?route=config'
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.json.ok, true);
  assert.equal(result.json.enabled, false);
});

test('GET /auth/config reporta enabled con env correcta', async () => {
  const handler = loadHandler({
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key'
  });

  const result = await invoke(handler, {
    method: 'GET',
    url: '/auth/config?route=config'
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.json.ok, true);
  assert.equal(result.json.enabled, true);
});

test('POST /auth/signup valida email/password obligatorios', async () => {
  const handler = loadHandler({
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key'
  });

  const result = await invoke(handler, {
    method: 'POST',
    url: '/auth/signup?route=signup',
    body: { email: 'foo@example.com' }
  });

  assert.equal(result.statusCode, 400);
  assert.equal(result.json.ok, false);
});

test('POST /auth/login enruta contra Supabase token password', async () => {
  const calls = [];
  const handler = loadHandler({
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key'
  });

  await withMockFetch(async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        access_token: 'access',
        refresh_token: 'refresh',
        user: { id: 'user-1', email: 'foo@example.com' }
      })
    };
  }, async () => {
    const result = await invoke(handler, {
      method: 'POST',
      url: '/auth/login?route=login',
      body: { email: 'foo@example.com', password: 'super-secret' }
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.json.ok, true);
    assert.equal(result.json.session.accessToken, 'access');
    assert.equal(result.json.user.id, 'user-1');
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /auth\/v1\/token\?grant_type=password/);
  assert.equal(calls[0].options.method, 'POST');
});

test('GET /auth/me requiere bearer y retorna user', async () => {
  const calls = [];
  const handler = loadHandler({
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key'
  });

  await withMockFetch(async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        id: 'user-1',
        email: 'foo@example.com'
      })
    };
  }, async () => {
    const result = await invoke(handler, {
      method: 'GET',
      url: '/auth/me?route=me',
      headers: { authorization: 'Bearer access-1' }
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.json.ok, true);
    assert.equal(result.json.user.id, 'user-1');
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /auth\/v1\/user$/);
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer access-1');
});
