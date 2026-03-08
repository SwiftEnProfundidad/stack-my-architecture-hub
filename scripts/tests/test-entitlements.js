'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { invoke, loadHandler, withMockFetch } = require('./helpers/serverless-api-test-utils.js');

test('GET /api/entitlements config reporta disabled si falta backend', async () => {
  const handler = loadHandler('api/entitlements.js', {
    SUPABASE_URL: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined
  });

  const result = await invoke(handler, {
    method: 'GET',
    url: '/api/entitlements?route=config'
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.json.ok, true);
  assert.equal(result.json.enabled, false);
});

test('GET /api/entitlements me requiere sesión autenticada', async () => {
  const handler = loadHandler('api/entitlements.js', {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
  });

  const result = await invoke(handler, {
    method: 'GET',
    url: '/api/entitlements?route=me'
  });

  assert.equal(result.statusCode, 401);
  assert.equal(result.json.ok, false);
});

test('GET /api/entitlements access permite teaser público sin login', async () => {
  const handler = loadHandler('api/entitlements.js', {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
  });

  await withMockFetch(async (url) => {
    if (String(url).includes('/hub_course_teasers')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify([
          {
            topic_id: '00-core-mobile-00-introduccion',
            kind: 'lesson',
            is_public: true,
            sort_order: 0
          }
        ])
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify([])
    };
  }, async () => {
    const result = await invoke(handler, {
      method: 'GET',
      url: '/api/entitlements?route=access&courseId=ios&topicId=00-core-mobile-00-introduccion'
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.json.ok, true);
    assert.equal(result.json.access.allowed, true);
    assert.equal(result.json.access.access, 'teaser');
    assert.deepEqual(result.json.access.teaserTopicIds, ['00-core-mobile-00-introduccion']);
  });
});

test('GET /api/entitlements me devuelve admin por bootstrap email y cursos permitidos', async () => {
  const handler = loadHandler('api/entitlements.js', {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    HUB_BOOTSTRAP_ADMIN_EMAILS: 'admin@example.com'
  });

  await withMockFetch(async (url, options) => {
    if (String(url).includes('/auth/v1/user')) {
      assert.equal(options.headers.Authorization, 'Bearer access-1');
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          id: '11111111-1111-4111-8111-111111111111',
          email: 'admin@example.com'
        })
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify([])
    };
  }, async () => {
    const result = await invoke(handler, {
      method: 'GET',
      url: '/api/entitlements?route=me',
      headers: { authorization: 'Bearer access-1' }
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.json.role, 'admin');
    assert.deepEqual(result.json.allowedCourses, ['ios', 'android', 'sdd']);
    assert.equal(result.json.entitlements.length, 3);
  });
});

test('GET /api/entitlements access concede acceso completo con entitlement activo', async () => {
  const handler = loadHandler('api/entitlements.js', {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
  });

  await withMockFetch(async (url) => {
    const value = String(url);
    if (value.includes('/auth/v1/user')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          id: '11111111-1111-4111-8111-111111111111',
          email: 'student@example.com'
        })
      };
    }
    if (value.includes('/hub_user_roles')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify([])
      };
    }
    if (value.includes('/hub_course_entitlements')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify([
          {
            id: 'ent-1',
            course_id: 'ios',
            plan_code: 'ios',
            status: 'active',
            granted_at: '2026-03-08T10:00:00.000Z',
            expires_at: null,
            notes: ''
          }
        ])
      };
    }
    if (value.includes('/hub_course_teasers')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify([])
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify([])
    };
  }, async () => {
    const result = await invoke(handler, {
      method: 'GET',
      url: '/api/entitlements?route=access&courseId=ios&topicId=01-fundamentos-00-introduccion-curso',
      headers: { authorization: 'Bearer access-1' }
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.json.access.allowed, true);
    assert.equal(result.json.access.access, 'full');
    assert.equal(result.json.access.fullAccess, true);
  });
});
