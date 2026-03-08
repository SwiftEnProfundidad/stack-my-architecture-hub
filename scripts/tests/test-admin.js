'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { invoke, loadHandler, withMockFetch } = require('./helpers/serverless-api-test-utils.js');

test('GET /api/admin users requiere rol admin', async () => {
  const handler = loadHandler('api/admin.js', {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
  });

  await withMockFetch(async (url) => {
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
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify([])
    };
  }, async () => {
    const result = await invoke(handler, {
      method: 'GET',
      url: '/api/admin?route=users',
      headers: { authorization: 'Bearer access-1' }
    });

    assert.equal(result.statusCode, 403);
    assert.equal(result.json.ok, false);
  });
});

test('GET /api/admin users devuelve usuarios con roles, entitlements y progreso', async () => {
  const handler = loadHandler('api/admin.js', {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    HUB_BOOTSTRAP_ADMIN_EMAILS: 'admin@example.com'
  });

  await withMockFetch(async (url) => {
    const value = String(url);
    if (value.includes('/auth/v1/user')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          email: 'admin@example.com'
        })
      };
    }
    if (value.includes('/auth/v1/admin/users')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          users: [{
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            email: 'student@example.com',
            created_at: '2026-03-08T10:00:00.000Z',
            email_confirmed_at: '2026-03-08T10:05:00.000Z'
          }]
        })
      };
    }
    if (value.includes('/hub_user_roles')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify([{ user_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', role: 'student' }])
      };
    }
    if (value.includes('/hub_course_entitlements')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify([{
          user_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          course_id: 'ios',
          plan_code: 'ios',
          status: 'active',
          granted_at: '2026-03-08T10:00:00.000Z',
          expires_at: null,
          notes: ''
        }])
      };
    }
    if (value.includes('/course_progress')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify([{
          profile_key: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          course_id: 'ios',
          updated_at: '2026-03-08T12:00:00.000Z',
          data: {
            completed: { one: true, two: true },
            review: { three: true },
            lastTopic: '01-fundamentos-00-introduccion-curso'
          }
        }])
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
      url: '/api/admin?route=users&q=student',
      headers: { authorization: 'Bearer access-1' }
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.json.ok, true);
    assert.equal(result.json.users.length, 1);
    assert.equal(result.json.users[0].email, 'student@example.com');
    assert.equal(result.json.users[0].entitlements[0].courseId, 'ios');
    assert.equal(result.json.users[0].progress[0].completedCount, 2);
  });
});

test('POST /api/admin grant-entitlement upserta y audita', async () => {
  const handler = loadHandler('api/admin.js', {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    HUB_BOOTSTRAP_ADMIN_EMAILS: 'admin@example.com'
  });

  const requests = [];
  await withMockFetch(async (url, options = {}) => {
    requests.push({ url: String(url), options });
    const value = String(url);
    if (value.includes('/auth/v1/user')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          email: 'admin@example.com'
        })
      };
    }
    if (value.includes('/hub_course_entitlements')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify([{
          course_id: 'android',
          plan_code: 'android',
          status: 'active',
          granted_at: '2026-03-08T10:00:00.000Z',
          expires_at: null,
          notes: 'manual'
        }])
      };
    }
    if (value.includes('/hub_admin_audit_log')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify([{}])
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
      url: '/api/admin?route=grant-entitlement',
      headers: { authorization: 'Bearer access-1' },
      body: {
        userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        courseId: 'android',
        planCode: 'android',
        notes: 'manual'
      }
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.json.ok, true);
    assert.equal(result.json.entitlement.courseId, 'android');
    assert.ok(requests.some((entry) => entry.url.includes('/hub_admin_audit_log')));
  });
});

test('POST /api/admin teaser-upsert persiste teaser publico', async () => {
  const handler = loadHandler('api/admin.js', {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    HUB_BOOTSTRAP_ADMIN_EMAILS: 'admin@example.com'
  });

  await withMockFetch(async (url) => {
    const value = String(url);
    if (value.includes('/auth/v1/user')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          email: 'admin@example.com'
        })
      };
    }
    if (value.includes('/hub_course_teasers')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify([{
          course_id: 'sdd',
          topic_id: '01-roadmap-00-mapa-16-semanas',
          kind: 'course_overview',
          is_public: true,
          sort_order: 0
        }])
      };
    }
    if (value.includes('/hub_admin_audit_log')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify([{}])
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
      url: '/api/admin?route=teaser-upsert',
      headers: { authorization: 'Bearer access-1' },
      body: {
        courseId: 'sdd',
        topicId: '01-roadmap-00-mapa-16-semanas',
        kind: 'course_overview',
        isPublic: true,
        sortOrder: 0
      }
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.json.ok, true);
    assert.equal(result.json.teaser.courseId, 'sdd');
    assert.equal(result.json.teaser.kind, 'course_overview');
  });
});

test('GET /api/admin audit-log devuelve eventos recientes para admin', async () => {
  const handler = loadHandler('api/admin.js', {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    HUB_BOOTSTRAP_ADMIN_EMAILS: 'admin@example.com'
  });

  await withMockFetch(async (url) => {
    const value = String(url);
    if (value.includes('/auth/v1/user')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          id: '11111111-1111-4111-8111-111111111111',
          email: 'admin@example.com'
        })
      };
    }
    if (value.includes('/hub_admin_audit_log')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify([
          {
            actor_user_id: '11111111-1111-4111-8111-111111111111',
            subject_user_id: '22222222-2222-4222-8222-222222222222',
            action: 'grant-entitlement',
            payload: { courseId: 'ios', planCode: 'ios' },
            created_at: '2026-03-08T10:00:00.000Z'
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
      url: '/api/admin?route=audit-log',
      headers: { authorization: 'Bearer admin-token' }
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.json.ok, true);
    assert.equal(result.json.entries.length, 1);
    assert.equal(result.json.entries[0].action, 'grant-entitlement');
  });
});
