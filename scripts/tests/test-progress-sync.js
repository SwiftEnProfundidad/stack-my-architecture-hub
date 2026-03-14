const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const HANDLER_PATH = path.resolve(__dirname, '../../api/progress-sync.js');

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

async function invoke(handler, { method = 'GET', url = '/progress/config?route=config', body, headers } = {}) {
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

test('GET /progress/config reporta disabled si falta backend', async () => {
  const handler = loadHandler({
    SUPABASE_URL: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined
  });

  const result = await invoke(handler, {
    method: 'GET',
    url: '/progress/config?route=config'
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.json.ok, true);
  assert.equal(result.json.enabled, false);
  assert.equal(result.json.requiresAuth, false);
});

test('GET /progress/state falla con 503 si backend no esta configurado', async () => {
  const handler = loadHandler({
    SUPABASE_URL: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined
  });

  const result = await invoke(handler, {
    method: 'GET',
    url: '/progress/state?route=state&courseId=stack-my-architecture-ios&profileKey=abc123abc123abc123abc123abc123ab'
  });

  assert.equal(result.statusCode, 503);
  assert.equal(result.json.ok, false);
  assert.match(String(result.json.error || ''), /no configurado/i);
});

test('GET /progress/state requiere bearer cuando el backend cloud está activo', async () => {
  const handler = loadHandler({
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    PROGRESS_SYNC_TABLE: 'course_progress'
  });

  const result = await invoke(handler, {
    method: 'GET',
    url: '/progress/state?route=state&courseId=stack-my-architecture-ios&profileKey=spoofed-profile'
  });

  assert.equal(result.statusCode, 401);
  assert.equal(result.json.ok, false);
  assert.match(String(result.json.error || ''), /sesi[oó]n|bearer|autentic/i);
});

test('GET /progress/config expone requiresAuth cuando el backend cloud está activo', async () => {
  const handler = loadHandler({
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
  });

  const result = await invoke(handler, {
    method: 'GET',
    url: '/progress/config?route=config'
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.json.ok, true);
  assert.equal(result.json.enabled, true);
  assert.equal(result.json.requiresAuth, true);
});

test('GET /progress/state deriva profileKey desde el usuario autenticado', async () => {
  const fetchCalls = [];
  const handler = loadHandler({
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    PROGRESS_SYNC_TABLE: 'course_progress'
  });

  await withMockFetch(async (url, options) => {
    fetchCalls.push({ url, options });
    if (String(url).includes('/auth/v1/user')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          id: 'user-123',
          email: 'student@example.com'
        })
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify([
        {
          course_id: 'stack-my-architecture-ios',
          profile_key: 'user-123',
          updated_at: '2026-03-01T20:00:00.000Z',
          data: {
            completed: { 'topic-1': true },
            review: {}
          }
        }
      ])
    };
  }, async () => {
    const result = await invoke(handler, {
      method: 'GET',
      url: '/progress/state?route=state&courseId=stack-my-architecture-ios&profileKey=profile-001',
      headers: { authorization: 'Bearer access-1' }
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.json.ok, true);
    assert.equal(result.json.state.courseId, 'stack-my-architecture-ios');
    assert.equal(result.json.state.profileKey, 'user-123');
    assert.equal(result.json.state.updatedAt, '2026-03-01T20:00:00.000Z');
    assert.deepEqual(result.json.state.data.completed, { 'topic-1': true });
  });

  assert.equal(fetchCalls.length, 2);
  assert.match(fetchCalls[0].url, /auth\/v1\/user$/);
  assert.equal(fetchCalls[0].options.method, 'GET');
  assert.equal(fetchCalls[0].options.headers.Authorization, 'Bearer access-1');
  assert.match(fetchCalls[1].url, /rest\/v1\/course_progress/);
  assert.match(fetchCalls[1].url, /profile_key=eq\.user-123/);
  assert.equal(fetchCalls[1].options.method, 'GET');
});

test('POST /progress/state hace upsert ligado al usuario autenticado', async () => {
  const fetchCalls = [];
  const handler = loadHandler({
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    PROGRESS_SYNC_TABLE: 'course_progress'
  });

  await withMockFetch(async (url, options) => {
    fetchCalls.push({ url, options });
    if (String(url).includes('/auth/v1/user')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          id: 'user-123',
          email: 'student@example.com'
        })
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify([
        {
          course_id: 'stack-my-architecture-ios',
          profile_key: 'user-123',
          updated_at: '2026-03-01T20:10:00.000Z',
          data: {
            completed: { 'topic-2': true },
            review: { 'topic-3': true },
            lastTopic: 'topic-2'
          }
        }
      ])
    };
  }, async () => {
    const result = await invoke(handler, {
      method: 'POST',
      url: '/progress/state?route=state',
      headers: { authorization: 'Bearer access-1' },
      body: {
        courseId: 'stack-my-architecture-ios',
        profileKey: 'spoofed-profile',
        clientUpdatedAt: '2026-03-01T20:09:59.000Z',
        data: {
          completed: { 'topic-2': true },
          review: { 'topic-3': true },
          lastTopic: 'topic-2'
        }
      }
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.json.ok, true);
    assert.equal(result.json.state.updatedAt, '2026-03-01T20:10:00.000Z');
    assert.equal(result.json.state.profileKey, 'user-123');
  });

  assert.equal(fetchCalls.length, 2);
  assert.match(fetchCalls[0].url, /auth\/v1\/user$/);
  assert.equal(fetchCalls[0].options.headers.Authorization, 'Bearer access-1');
  assert.match(fetchCalls[1].url, /on_conflict=course_id(%2C|,)profile_key/);
  assert.equal(fetchCalls[1].options.method, 'POST');

  const sent = JSON.parse(fetchCalls[1].options.body);
  assert.equal(Array.isArray(sent), true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].course_id, 'stack-my-architecture-ios');
  assert.equal(sent[0].profile_key, 'user-123');
  assert.deepEqual(sent[0].data, {
    completed: { 'topic-2': true },
    review: { 'topic-3': true },
    lastTopic: 'topic-2'
  });
});
