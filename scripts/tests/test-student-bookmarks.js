'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { invoke, loadHandler, withMockFetch } = require('./helpers/serverless-api-test-utils.js');

test('GET /api/student-bookmarks requiere sesión autenticada', async () => {
  const handler = loadHandler('api/student-bookmarks.js', {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
  });

  const result = await invoke(handler, {
    method: 'GET',
    url: '/api/student-bookmarks?route=list&courseId=ios'
  });

  assert.equal(result.statusCode, 401);
});

test('POST /api/student-bookmarks toggle crea bookmark si no existe', async () => {
  const handler = loadHandler('api/student-bookmarks.js', {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
  });

  const fetchCalls = [];
  await withMockFetch(async (url, options) => {
    fetchCalls.push({ url: String(url), options });
    if (String(url).includes('/auth/v1/user')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          id: '11111111-1111-4111-8111-111111111111',
          email: 'student@example.com'
        })
      };
    }
    if (String(url).includes('/hub_user_roles') || String(url).includes('/hub_course_entitlements')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify([])
      };
    }
    if (String(url).includes('/hub_student_bookmarks') && options.method === 'GET') {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify([])
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify([
        {
          course_id: 'stack-my-architecture-ios',
          topic_id: '00-core-mobile-04-quality-pr-ready',
          updated_at: '2026-03-08T10:11:00.000Z'
        }
      ])
    };
  }, async () => {
    const result = await invoke(handler, {
      method: 'POST',
      url: '/api/student-bookmarks?route=toggle',
      headers: { authorization: 'Bearer access-1' },
      body: {
        courseId: 'stack-my-architecture-ios',
        topicId: '00-core-mobile-04-quality-pr-ready'
      }
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.json.ok, true);
    assert.equal(result.json.active, true);
    assert.equal(result.json.bookmark.topicId, '00-core-mobile-04-quality-pr-ready');
  });

  const upsertCall = fetchCalls.find((item) => item.url.includes('/hub_student_bookmarks?on_conflict='));
  const sent = JSON.parse(upsertCall.options.body);
  assert.equal(sent[0].user_id, '11111111-1111-4111-8111-111111111111');
  assert.equal(sent[0].course_id, 'ios');
});

test('POST /api/student-bookmarks devuelve error accionable si Supabase deniega acceso a la tabla', async () => {
  const handler = loadHandler('api/student-bookmarks.js', {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
  });

  await withMockFetch(async (url, options) => {
    if (String(url).includes('/auth/v1/user')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          id: '11111111-1111-4111-8111-111111111111',
          email: 'student@example.com'
        })
      };
    }
    if (String(url).includes('/hub_user_roles') || String(url).includes('/hub_course_entitlements')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify([])
      };
    }
    if (String(url).includes('/hub_student_bookmarks') && options.method === 'GET') {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify([])
      };
    }
    if (String(url).includes('/hub_student_bookmarks') && options.method === 'POST') {
      return {
        ok: false,
        status: 403,
        text: async () => JSON.stringify({
          message: 'permission denied for table hub_student_bookmarks'
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
      method: 'POST',
      url: '/api/student-bookmarks?route=toggle',
      headers: { authorization: 'Bearer access-1' },
      body: {
        courseId: 'ios',
        topicId: '00-core-mobile-01-marco-de-decisiones-arquitectonicas'
      }
    });

    assert.equal(result.statusCode, 503);
    assert.match(result.json.error, /Supabase está denegando acceso a los bookmarks privados/i);
    assert.match(result.json.error, /hub_student_bookmarks/i);
  });
});
