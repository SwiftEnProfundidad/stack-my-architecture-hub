'use strict';

const {
  DEFAULT_NOTES_TABLE,
  DEFAULT_ROLE_TABLE,
  DEFAULT_ENTITLEMENTS_TABLE,
  deleteRows,
  fetchOptionalRows,
  isBackendConfigured,
  normalizeCourseId,
  normalizeNoteContent,
  normalizeTableName,
  normalizeTopicId,
  resolveUserContext,
  sendJson,
  setCorsHeaders,
  toErrorMessage,
  toStatusCode,
  upsertRows,
  readJsonBody,
  parseQuery
} = require('./_hub-platform.js');

const ROLE_TABLE = normalizeTableName(process.env.HUB_ROLE_TABLE, DEFAULT_ROLE_TABLE);
const ENTITLEMENTS_TABLE = normalizeTableName(process.env.HUB_ENTITLEMENTS_TABLE, DEFAULT_ENTITLEMENTS_TABLE);
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
  const context = await resolveUserContext(req, {
    roleTable: ROLE_TABLE,
    entitlementsTable: ENTITLEMENTS_TABLE
  });
  if (!context.authenticated) {
    const error = new Error('Se requiere sesión autenticada.');
    error.statusCode = 401;
    throw error;
  }
  return context;
}

async function handleList(req, res) {
  if (!isBackendConfigured()) {
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
    });

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
    sendJson(res, toStatusCode(error), {
      ok: false,
      error: toErrorMessage(error)
    });
  }
}

async function handleUpsert(req, res) {
  if (!isBackendConfigured()) {
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
      });
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
    }], 'user_id,course_id,topic_id');

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
    sendJson(res, toStatusCode(error), {
      ok: false,
      error: toErrorMessage(error)
    });
  }
}
