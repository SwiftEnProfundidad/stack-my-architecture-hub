'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { invoke, loadHandler, withMockFetch } = require('./helpers/serverless-api-test-utils.js');

test('GET /api/dashboard requiere sesión autenticada', async () => {
  const handler = loadHandler('api/dashboard.js', {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
  });

  const result = await invoke(handler, {
    method: 'GET',
    url: '/api/dashboard'
  });

  assert.equal(result.statusCode, 401);
  assert.equal(result.json.ok, false);
});

test('GET /api/dashboard agrega progreso, notas, bookmarks y siguiente paso', async () => {
  const handler = loadHandler('api/dashboard.js', {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    PROGRESS_SYNC_TABLE: 'course_progress'
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
    if (value.includes('/course_progress')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify([
          {
            course_id: 'stack-my-architecture-ios',
            updated_at: '2026-03-08T10:05:00.000Z',
            data: {
              completed: {
                '00-core-mobile-00-introduccion': true,
                '00-core-mobile-01-decision-framework': true
              },
              review: {
                '00-core-mobile-04-quality-pr-ready': true
              },
              lastTopic: '00-core-mobile-04-quality-pr-ready'
            }
          }
        ])
      };
    }
    if (value.includes('/hub_student_notes')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify([
          {
            course_id: 'stack-my-architecture-ios',
            topic_id: '00-core-mobile-04-quality-pr-ready',
            content: 'Recordar los quality gates y el criterio de PR-ready.',
            updated_at: '2026-03-08T10:04:00.000Z'
          }
        ])
      };
    }
    if (value.includes('/hub_student_bookmarks')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify([
          { course_id: 'stack-my-architecture-ios', topic_id: '00-core-mobile-04-quality-pr-ready', updated_at: '2026-03-08T10:04:30.000Z' }
        ])
      };
    }
    if (value.includes('/hub_course_teasers')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify([
          { course_id: 'android', topic_id: '00-nivel-cero-00-introduccion', is_public: true }
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
      url: '/api/dashboard',
      headers: { authorization: 'Bearer access-1' }
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.json.ok, true);
    assert.equal(result.json.courses.length, 3);
    assert.deepEqual(result.json.allowedCourses, ['ios']);

    const ios = result.json.courses.find((item) => item.courseId === 'ios');
    const android = result.json.courses.find((item) => item.courseId === 'android');

    assert.equal(ios.access, 'full');
    assert.equal(ios.completedCount, 2);
    assert.equal(ios.reviewCount, 1);
    assert.equal(ios.noteCount, 1);
    assert.equal(ios.bookmarkCount, 1);
    assert.equal(ios.currentStageLabel, 'Etapa 0 · Core Mobile');
    assert.equal(ios.currentStageOrdinal, 1);
    assert.equal(ios.completedCheckpoints, 0);
    assert.equal(ios.totalCheckpoints, 7);
    assert.equal(ios.stageProgressPercent, 14);
    assert.equal(ios.nextStageLabel, 'Etapa 1 · Junior');
    assert.equal(ios.nextStep.topicId, '00-core-mobile-04-quality-pr-ready');
    assert.equal(ios.reviewTargetTopicId, '00-core-mobile-04-quality-pr-ready');
    assert.equal(ios.bookmarkTargetTopicId, '00-core-mobile-04-quality-pr-ready');
    assert.equal(ios.noteTargetTopicId, '00-core-mobile-04-quality-pr-ready');
    assert.equal(android.access, 'teaser');
    assert.equal(result.json.notes.length, 1);
    assert.equal(result.json.notes[0].preview.includes('quality gates'), true);
    assert.equal(result.json.bookmarks.length, 1);
    assert.equal(result.json.entitlements.length, 1);
    assert.equal(result.json.reviewQueue.length, 1);
    assert.equal(result.json.reviewQueue[0].topicId, '00-core-mobile-04-quality-pr-ready');
  });
});
