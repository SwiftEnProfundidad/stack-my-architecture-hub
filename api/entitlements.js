'use strict';

const {
  COURSE_IDS,
  DEFAULT_ENTITLEMENTS_TABLE,
  DEFAULT_ROLE_TABLE,
  DEFAULT_TEASERS_TABLE,
  isBackendConfigured,
  mapAllowedCourses,
  normalizeCourseId,
  normalizeTableName,
  parseQuery,
  resolveCourseAccess,
  resolveRoute,
  resolveUserContext,
  sendJson,
  setCorsHeaders,
  toErrorMessage,
  toStatusCode
} = require('./_hub-platform.js');

const ROLE_TABLE = normalizeTableName(process.env.HUB_ROLE_TABLE, DEFAULT_ROLE_TABLE);
const ENTITLEMENTS_TABLE = normalizeTableName(process.env.HUB_ENTITLEMENTS_TABLE, DEFAULT_ENTITLEMENTS_TABLE);
const TEASERS_TABLE = normalizeTableName(process.env.HUB_TEASERS_TABLE, DEFAULT_TEASERS_TABLE);

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const route = resolveRoute(req);

  if (route === 'config' && req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      enabled: isBackendConfigured(),
      provider: 'supabase-rest',
      schemaVersion: 1,
      courses: COURSE_IDS
    });
    return;
  }

  if (route === 'me' && req.method === 'GET') {
    await handleMe(req, res);
    return;
  }

  if (route === 'access' && req.method === 'GET') {
    await handleAccess(req, res);
    return;
  }

  sendJson(res, 404, {
    ok: false,
    error: 'Ruta no encontrada para entitlements.'
  });
};

async function handleMe(req, res) {
  if (!isBackendConfigured()) {
    sendJson(res, 503, {
      ok: false,
      error: 'Backend de entitlements no configurado en este entorno.'
    });
    return;
  }

  try {
    const context = await resolveUserContext(req, {
      roleTable: ROLE_TABLE,
      entitlementsTable: ENTITLEMENTS_TABLE
    });

    if (!context.authenticated) {
      const error = new Error('Se requiere sesión autenticada.');
      error.statusCode = 401;
      throw error;
    }

    sendJson(res, 200, {
      ok: true,
      user: context.user,
      role: context.role,
      allowedCourses: mapAllowedCourses(context),
      entitlements: context.entitlements
    });
  } catch (error) {
    sendJson(res, toStatusCode(error), {
      ok: false,
      error: toErrorMessage(error)
    });
  }
}

async function handleAccess(req, res) {
  if (!isBackendConfigured()) {
    sendJson(res, 503, {
      ok: false,
      error: 'Backend de entitlements no configurado en este entorno.'
    });
    return;
  }

  const query = parseQuery(req.url);
  const courseId = normalizeCourseId(query.courseId);
  const topicId = String(query.topicId || '').trim();

  if (!courseId) {
    sendJson(res, 400, {
      ok: false,
      error: 'courseId es obligatorio.'
    });
    return;
  }

  try {
    const access = await resolveCourseAccess({
      req,
      courseId,
      topicId,
      roleTable: ROLE_TABLE,
      entitlementsTable: ENTITLEMENTS_TABLE,
      teasersTable: TEASERS_TABLE
    });

    sendJson(res, 200, {
      ok: true,
      access
    });
  } catch (error) {
    sendJson(res, toStatusCode(error), {
      ok: false,
      error: toErrorMessage(error)
    });
  }
}
