'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { invoke, loadHandler, withMockFetch } = require('./helpers/serverless-api-test-utils.js');

test('GET /api/student-notes requiere sesión autenticada', async () => {
  const handler = loadHandler('api/student-notes.js', {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
  });

  const result = await invoke(handler, {
    method: 'GET',
    url: '/api/student-notes?route=list&courseId=ios'
  });

  assert.equal(result.statusCode, 401);
});

test('POST /api/student-notes upsert persiste nota por usuario y lección', async () => {
  const handler = loadHandler('api/student-notes.js', {
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
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify([
        {
          course_id: 'stack-my-architecture-ios',
          topic_id: '00-core-mobile-04-quality-pr-ready',
          content: 'Resumen clave',
          updated_at: '2026-03-08T10:10:00.000Z'
        }
      ])
    };
  }, async () => {
    const result = await invoke(handler, {
      method: 'POST',
      url: '/api/student-notes?route=upsert',
      headers: { authorization: 'Bearer access-1' },
      body: {
        courseId: 'stack-my-architecture-ios',
        topicId: '00-core-mobile-04-quality-pr-ready',
        content: 'Resumen clave'
      }
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.json.ok, true);
    assert.equal(result.json.note.topicId, '00-core-mobile-04-quality-pr-ready');
    assert.equal(result.json.note.content, 'Resumen clave');
  });

  const upsertCall = fetchCalls.find((item) => item.url.includes('/hub_student_notes?on_conflict='));
  const sent = JSON.parse(upsertCall.options.body);
  assert.equal(sent[0].user_id, '11111111-1111-4111-8111-111111111111');
  assert.equal(sent[0].course_id, 'ios');
});
