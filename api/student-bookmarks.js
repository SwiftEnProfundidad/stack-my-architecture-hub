'use strict';

const {
  DEFAULT_BOOKMARKS_TABLE,
  deleteRows,
  fetchOptionalRows,
  isUserScopedBackendConfigured,
  normalizeCourseId,
  normalizeTableName,
  normalizeTopicId,
  parseQuery,
  readJsonBody,
  readBearerToken,
  resolveAuthenticatedUser,
  sendJson,
  setCorsHeaders,
  supabasePublicKey,
  toErrorMessage,
  toStatusCode,
  withInfrastructureGuidance,
  upsertRows
} = require('./_hub-platform.js');

const BOOKMARKS_TABLE = normalizeTableName(process.env.HUB_BOOKMARKS_TABLE, DEFAULT_BOOKMARKS_TABLE);

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const route = String(parseQuery(req.url).route || '').trim().toLowerCase();

  if (route === 'list' && req.method === 'GET') {
    await handleList(req, res);
    return;
  }

  if (route === 'toggle' && req.method === 'POST') {
    await handleToggle(req, res);
    return;
  }

  sendJson(res, 404, {
    ok: false,
    error: 'Ruta no encontrada para student-bookmarks.'
  });
};

async function requireContext(req) {
  const user = await resolveAuthenticatedUser(req, { optional: true });
  if (!user || !user.id) {
    const error = new Error('Se requiere sesión autenticada.');
    error.statusCode = 401;
    throw error;
  }
  return {
    user: {
      id: String(user.id || ''),
      email: String(user.email || '')
    },
    requestOptions: {
      supabaseKey: supabasePublicKey(),
      bearerToken: readBearerToken(req)
    }
  };
}

async function handleList(req, res) {
  if (!isUserScopedBackendConfigured()) {
    sendJson(res, 503, {
      ok: false,
      error: 'Backend de bookmarks no configurado en este entorno.'
    });
    return;
  }

  try {
    const context = await requireContext(req);
    const query = parseQuery(req.url);
    const courseId = normalizeCourseId(query.courseId);
    if (!courseId) {
      const error = new Error('courseId es obligatorio.');
      error.statusCode = 400;
      throw error;
    }

    const rows = await fetchOptionalRows(BOOKMARKS_TABLE, {
      select: 'course_id,topic_id,updated_at',
      user_id: `eq.${context.user.id}`,
      course_id: `eq.${courseId}`,
      order: 'updated_at.desc'
    }, context.requestOptions);

    sendJson(res, 200, {
      ok: true,
      bookmarks: rows.map((row) => ({
        courseId: normalizeCourseId(row.course_id),
        topicId: normalizeTopicId(row.topic_id),
        updatedAt: String(row.updated_at || '')
      })).filter((row) => row.courseId && row.topicId)
    });
  } catch (error) {
    const next = withInfrastructureGuidance(error, {
      table: BOOKMARKS_TABLE,
      featureLabel: 'los bookmarks privados',
      principalLabel: 'authenticated'
    });
    sendJson(res, toStatusCode(next), {
      ok: false,
      error: toErrorMessage(next)
    });
  }
}

async function handleToggle(req, res) {
  if (!isUserScopedBackendConfigured()) {
    sendJson(res, 503, {
      ok: false,
      error: 'Backend de bookmarks no configurado en este entorno.'
    });
    return;
  }

  try {
    const context = await requireContext(req);
    const body = await readJsonBody(req);
    const courseId = normalizeCourseId(body.courseId);
    const topicId = normalizeTopicId(body.topicId);

    if (!courseId || !topicId) {
      const error = new Error('courseId y topicId son obligatorios.');
      error.statusCode = 400;
      throw error;
    }

    const existing = await fetchOptionalRows(BOOKMARKS_TABLE, {
      select: 'course_id,topic_id,updated_at',
      user_id: `eq.${context.user.id}`,
      course_id: `eq.${courseId}`,
      topic_id: `eq.${topicId}`,
      limit: '1'
    }, context.requestOptions);

    if (existing.length) {
      await deleteRows(BOOKMARKS_TABLE, {
        user_id: `eq.${context.user.id}`,
        course_id: `eq.${courseId}`,
        topic_id: `eq.${topicId}`
      }, context.requestOptions);
      sendJson(res, 200, {
        ok: true,
        active: false,
        bookmark: null
      });
      return;
    }

    const rows = await upsertRows(BOOKMARKS_TABLE, [{
      user_id: context.user.id,
      course_id: courseId,
      topic_id: topicId,
      updated_at: new Date().toISOString()
    }], 'user_id,course_id,topic_id', context.requestOptions);

    const row = rows[0] || null;
    sendJson(res, 200, {
      ok: true,
      active: true,
      bookmark: row ? {
        courseId: normalizeCourseId(row.course_id),
        topicId: normalizeTopicId(row.topic_id),
        updatedAt: String(row.updated_at || '')
      } : {
        courseId,
        topicId,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    const next = withInfrastructureGuidance(error, {
      table: BOOKMARKS_TABLE,
      featureLabel: 'los bookmarks privados',
      principalLabel: 'authenticated'
    });
    sendJson(res, toStatusCode(next), {
      ok: false,
      error: toErrorMessage(next)
    });
  }
}
