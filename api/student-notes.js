'use strict';

const {
  DEFAULT_NOTES_TABLE,
  deleteRows,
  fetchOptionalRows,
  isUserScopedBackendConfigured,
  normalizeCourseId,
  normalizeNoteContent,
  normalizeTableName,
  normalizeTopicId,
  readBearerToken,
  resolveAuthenticatedUser,
  sendJson,
  setCorsHeaders,
  supabasePublicKey,
  toErrorMessage,
  toStatusCode,
  upsertRows,
  withInfrastructureGuidance,
  readJsonBody,
  parseQuery
} = require('./_hub-platform.js');

const NOTES_TABLE = normalizeTableName(process.env.HUB_NOTES_TABLE, DEFAULT_NOTES_TABLE);

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

  if (route === 'upsert' && req.method === 'POST') {
    await handleUpsert(req, res);
    return;
  }

  sendJson(res, 404, {
    ok: false,
    error: 'Ruta no encontrada para student-notes.'
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
      error: 'Backend de notas no configurado en este entorno.'
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

    const rows = await fetchOptionalRows(NOTES_TABLE, {
      select: 'course_id,topic_id,content,updated_at',
      user_id: `eq.${context.user.id}`,
      course_id: `eq.${courseId}`,
      order: 'updated_at.desc'
    }, context.requestOptions);

    sendJson(res, 200, {
      ok: true,
      notes: rows.map((row) => ({
        courseId: normalizeCourseId(row.course_id),
        topicId: normalizeTopicId(row.topic_id),
        content: String(row.content || ''),
        updatedAt: String(row.updated_at || '')
      })).filter((row) => row.courseId && row.topicId)
    });
  } catch (error) {
    const next = withInfrastructureGuidance(error, {
      table: NOTES_TABLE,
      featureLabel: 'las notas privadas',
      principalLabel: 'authenticated'
    });
    sendJson(res, toStatusCode(next), {
      ok: false,
      error: toErrorMessage(next)
    });
  }
}

async function handleUpsert(req, res) {
  if (!isUserScopedBackendConfigured()) {
    sendJson(res, 503, {
      ok: false,
      error: 'Backend de notas no configurado en este entorno.'
    });
    return;
  }

  try {
    const context = await requireContext(req);
    const body = await readJsonBody(req);
    const courseId = normalizeCourseId(body.courseId);
    const topicId = normalizeTopicId(body.topicId);
    const content = normalizeNoteContent(body.content);

    if (!courseId || !topicId) {
      const error = new Error('courseId y topicId son obligatorios.');
      error.statusCode = 400;
      throw error;
    }

    if (!content) {
      await deleteRows(NOTES_TABLE, {
        user_id: `eq.${context.user.id}`,
        course_id: `eq.${courseId}`,
        topic_id: `eq.${topicId}`
      }, context.requestOptions);
      sendJson(res, 200, {
        ok: true,
        note: null
      });
      return;
    }

    const rows = await upsertRows(NOTES_TABLE, [{
      user_id: context.user.id,
      course_id: courseId,
      topic_id: topicId,
      content,
      updated_at: new Date().toISOString()
    }], 'user_id,course_id,topic_id', context.requestOptions);

    const row = rows[0] || null;
    sendJson(res, 200, {
      ok: true,
      note: row ? {
        courseId: normalizeCourseId(row.course_id),
        topicId: normalizeTopicId(row.topic_id),
        content: String(row.content || ''),
        updatedAt: String(row.updated_at || '')
      } : {
        courseId,
        topicId,
        content,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    const next = withInfrastructureGuidance(error, {
      table: NOTES_TABLE,
      featureLabel: 'las notas privadas',
      principalLabel: 'authenticated'
    });
    sendJson(res, toStatusCode(next), {
      ok: false,
      error: toErrorMessage(next)
    });
  }
}
