'use strict';

const {
  COURSE_IDS,
  DEFAULT_AUDIT_TABLE,
  DEFAULT_ENTITLEMENTS_TABLE,
  DEFAULT_ROLE_TABLE,
  DEFAULT_TEASERS_TABLE,
  deleteRows,
  fetchOptionalRows,
  fetchRows,
  fetchSupabaseJson,
  isBackendConfigured,
  normalizeCourseId,
  normalizeCourseScope,
  normalizeEntitlementStatus,
  normalizeIsoDate,
  normalizePlanCode,
  normalizeRole,
  normalizeTableName,
  normalizeTeaserKind,
  normalizeTopicId,
  parseQuery,
  readJsonBody,
  resolveUserContext,
  sendJson,
  setCorsHeaders,
  supabaseAuthBase,
  toErrorMessage,
  toStatusCode,
  upsertRows
} = require('./_hub-platform.js');

const ROLE_TABLE = normalizeTableName(process.env.HUB_ROLE_TABLE, DEFAULT_ROLE_TABLE);
const ENTITLEMENTS_TABLE = normalizeTableName(process.env.HUB_ENTITLEMENTS_TABLE, DEFAULT_ENTITLEMENTS_TABLE);
const TEASERS_TABLE = normalizeTableName(process.env.HUB_TEASERS_TABLE, DEFAULT_TEASERS_TABLE);
const AUDIT_TABLE = normalizeTableName(process.env.HUB_AUDIT_TABLE, DEFAULT_AUDIT_TABLE);
const PROGRESS_TABLE = normalizeTableName(process.env.PROGRESS_SYNC_TABLE, 'course_progress');
const MAX_USERS = 200;

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const route = String(parseQuery(req.url).route || '').trim().toLowerCase();

  if (route === 'users' && req.method === 'GET') {
    await handleUsers(req, res);
    return;
  }

  if (route === 'teasers' && req.method === 'GET') {
    await handleTeasers(req, res);
    return;
  }

  if (route === 'audit-log' && req.method === 'GET') {
    await handleAuditLog(req, res);
    return;
  }

  if (route === 'set-role' && req.method === 'POST') {
    await handleSetRole(req, res);
    return;
  }

  if (route === 'grant-entitlement' && req.method === 'POST') {
    await handleGrantEntitlement(req, res);
    return;
  }

  if (route === 'revoke-entitlement' && req.method === 'POST') {
    await handleRevokeEntitlement(req, res);
    return;
  }

  if (route === 'teaser-upsert' && req.method === 'POST') {
    await handleTeaserUpsert(req, res);
    return;
  }

  sendJson(res, 404, {
    ok: false,
    error: 'Ruta no encontrada para admin.'
  });
};

async function requireAdminContext(req) {
  const context = await resolveUserContext(req, {
    roleTable: ROLE_TABLE,
    entitlementsTable: ENTITLEMENTS_TABLE
  });
  if (!context.authenticated) {
    const error = new Error('Se requiere sesión autenticada.');
    error.statusCode = 401;
    throw error;
  }
  if (context.role !== 'admin') {
    const error = new Error('Se requiere rol admin.');
    error.statusCode = 403;
    throw error;
  }
  return context;
}

async function handleUsers(req, res) {
  if (!isBackendConfigured()) {
    sendJson(res, 503, { ok: false, error: 'Backend admin no configurado en este entorno.' });
    return;
  }

  try {
    await requireAdminContext(req);
    const query = parseQuery(req.url);
    const search = String(query.q || '').trim().toLowerCase();

    const authPayload = await fetchSupabaseJson(`${supabaseAuthBase()}/admin/users?page=1&per_page=${MAX_USERS}`, {
      method: 'GET'
    });

    const authUsers = Array.isArray(authPayload && authPayload.users) ? authPayload.users : [];
    const filteredUsers = authUsers.filter((user) => {
      if (!search) return true;
      const email = String(user && user.email || '').toLowerCase();
      const id = String(user && user.id || '').toLowerCase();
      return email.includes(search) || id.includes(search);
    });

    const [roleRows, entitlementRows, progressRows] = await Promise.all([
      fetchOptionalRows(ROLE_TABLE, {
        select: 'user_id,role'
      }),
      fetchOptionalRows(ENTITLEMENTS_TABLE, {
        select: 'user_id,course_id,plan_code,status,granted_at,expires_at,notes',
        order: 'granted_at.desc'
      }),
      fetchOptionalRows(PROGRESS_TABLE, {
        select: 'profile_key,course_id,updated_at,data'
      })
    ]);

    const roleByUserId = new Map();
    roleRows.forEach((row) => {
      const userId = String(row.user_id || '').trim();
      if (!userId) return;
      roleByUserId.set(userId, normalizeRole(row.role));
    });

    const entitlementsByUserId = new Map();
    entitlementRows.forEach((row) => {
      const userId = String(row.user_id || '').trim();
      if (!userId) return;
      const list = entitlementsByUserId.get(userId) || [];
      const courseId = normalizeCourseScope(row.course_id);
      if (!courseId) return;
      list.push({
        courseId,
        planCode: normalizePlanCode(row.plan_code),
        status: normalizeEntitlementStatus(row.status),
        grantedAt: normalizeIsoDate(row.granted_at),
        expiresAt: normalizeIsoDate(row.expires_at),
        notes: String(row.notes || '')
      });
      entitlementsByUserId.set(userId, list);
    });

    const progressByUserId = new Map();
    progressRows.forEach((row) => {
      const userId = String(row.profile_key || '').trim();
      if (!userId) return;
      const courseId = normalizeCourseId(row.course_id);
      if (!courseId) return;
      const list = progressByUserId.get(userId) || [];
      const data = row && row.data && typeof row.data === 'object' ? row.data : {};
      list.push({
        courseId,
        updatedAt: String(row.updated_at || ''),
        completedCount: Object.keys(data.completed && typeof data.completed === 'object' ? data.completed : {}).length,
        reviewCount: Object.keys(data.review && typeof data.review === 'object' ? data.review : {}).length,
        lastTopic: String(data.lastTopic || '')
      });
      progressByUserId.set(userId, list);
    });

    const users = filteredUsers.map((user) => {
      const userId = String(user && user.id || '').trim();
      return {
        id: userId,
        email: String(user && user.email || ''),
        emailConfirmedAt: String((user && user.email_confirmed_at) || ''),
        createdAt: String((user && user.created_at) || ''),
        role: roleByUserId.get(userId) || 'student',
        entitlements: entitlementsByUserId.get(userId) || [],
        progress: progressByUserId.get(userId) || []
      };
    });

    sendJson(res, 200, {
      ok: true,
      users
    });
  } catch (error) {
    sendJson(res, toStatusCode(error), { ok: false, error: toErrorMessage(error) });
  }
}

async function handleTeasers(req, res) {
  if (!isBackendConfigured()) {
    sendJson(res, 503, { ok: false, error: 'Backend admin no configurado en este entorno.' });
    return;
  }

  try {
    await requireAdminContext(req);
    const query = parseQuery(req.url);
    const courseId = normalizeCourseId(query.courseId);
    const filters = { select: 'course_id,topic_id,kind,is_public,sort_order', order: 'course_id.asc,sort_order.asc,topic_id.asc' };
    if (courseId) filters.course_id = `eq.${courseId}`;
    const rows = await fetchOptionalRows(TEASERS_TABLE, filters);
    const teasers = rows.map((row) => ({
      courseId: normalizeCourseId(row.course_id),
      topicId: normalizeTopicId(row.topic_id),
      kind: normalizeTeaserKind(row.kind),
      isPublic: row.is_public !== false,
      sortOrder: Number(row.sort_order || 0)
    })).filter((row) => row.courseId && row.topicId);
    sendJson(res, 200, { ok: true, teasers });
  } catch (error) {
    sendJson(res, toStatusCode(error), { ok: false, error: toErrorMessage(error) });
  }
}

async function handleAuditLog(req, res) {
  if (!isBackendConfigured()) {
    sendJson(res, 503, { ok: false, error: 'Backend admin no configurado en este entorno.' });
    return;
  }

  try {
    await requireAdminContext(req);
    const rows = await fetchOptionalRows(AUDIT_TABLE, {
      select: 'actor_user_id,subject_user_id,action,payload,created_at',
      order: 'created_at.desc',
      limit: '25'
    });

    sendJson(res, 200, {
      ok: true,
      entries: rows.map((row) => ({
        actorUserId: String(row.actor_user_id || ''),
        subjectUserId: String(row.subject_user_id || ''),
        action: String(row.action || ''),
        payload: row.payload && typeof row.payload === 'object' ? row.payload : {},
        createdAt: String(row.created_at || '')
      }))
    });
  } catch (error) {
    sendJson(res, toStatusCode(error), { ok: false, error: toErrorMessage(error) });
  }
}

async function handleSetRole(req, res) {
  if (!isBackendConfigured()) {
    sendJson(res, 503, { ok: false, error: 'Backend admin no configurado en este entorno.' });
    return;
  }

  try {
    const context = await requireAdminContext(req);
    const body = await readJsonBody(req);
    const userId = String(body.userId || '').trim();
    const role = normalizeRole(body.role);
    if (!userId) {
      const error = new Error('userId es obligatorio.');
      error.statusCode = 400;
      throw error;
    }

    const rows = await upsertRows(ROLE_TABLE, [{
      user_id: userId,
      role,
      updated_at: new Date().toISOString()
    }], 'user_id');

    await insertAuditLog({
      actorUserId: context.user.id,
      subjectUserId: userId,
      action: 'set-role',
      payload: { role }
    });

    sendJson(res, 200, {
      ok: true,
      role: rows[0] ? normalizeRole(rows[0].role) : role
    });
  } catch (error) {
    sendJson(res, toStatusCode(error), { ok: false, error: toErrorMessage(error) });
  }
}

async function handleGrantEntitlement(req, res) {
  if (!isBackendConfigured()) {
    sendJson(res, 503, { ok: false, error: 'Backend admin no configurado en este entorno.' });
    return;
  }

  try {
    const context = await requireAdminContext(req);
    const body = await readJsonBody(req);
    const userId = String(body.userId || '').trim();
    const courseId = normalizeCourseScope(body.courseId);
    const planCode = normalizePlanCode(body.planCode || courseId);
    const status = normalizeEntitlementStatus(body.status || 'active');
    const expiresAt = normalizeIsoDate(body.expiresAt);
    const notes = String(body.notes || '').trim();

    if (!userId || !courseId || !planCode) {
      const error = new Error('userId, courseId y planCode son obligatorios.');
      error.statusCode = 400;
      throw error;
    }

    const rows = await upsertRows(ENTITLEMENTS_TABLE, [{
      user_id: userId,
      course_id: courseId,
      plan_code: planCode,
      status,
      granted_by: context.user.id,
      granted_at: new Date().toISOString(),
      expires_at: expiresAt,
      notes,
      updated_at: new Date().toISOString()
    }], 'user_id,course_id');

    await insertAuditLog({
      actorUserId: context.user.id,
      subjectUserId: userId,
      action: 'grant-entitlement',
      payload: { courseId, planCode, status, expiresAt, notes }
    });

    const row = rows[0] || null;
    sendJson(res, 200, {
      ok: true,
      entitlement: row ? {
        courseId: normalizeCourseScope(row.course_id),
        planCode: normalizePlanCode(row.plan_code),
        status: normalizeEntitlementStatus(row.status),
        grantedAt: normalizeIsoDate(row.granted_at),
        expiresAt: normalizeIsoDate(row.expires_at),
        notes: String(row.notes || '')
      } : {
        courseId,
        planCode,
        status,
        grantedAt: new Date().toISOString(),
        expiresAt,
        notes
      }
    });
  } catch (error) {
    sendJson(res, toStatusCode(error), { ok: false, error: toErrorMessage(error) });
  }
}

async function handleRevokeEntitlement(req, res) {
  if (!isBackendConfigured()) {
    sendJson(res, 503, { ok: false, error: 'Backend admin no configurado en este entorno.' });
    return;
  }

  try {
    const context = await requireAdminContext(req);
    const body = await readJsonBody(req);
    const userId = String(body.userId || '').trim();
    const courseId = normalizeCourseScope(body.courseId);
    const notes = String(body.notes || '').trim();

    if (!userId || !courseId) {
      const error = new Error('userId y courseId son obligatorios.');
      error.statusCode = 400;
      throw error;
    }

    const existing = await fetchOptionalRows(ENTITLEMENTS_TABLE, {
      select: 'course_id,plan_code',
      user_id: `eq.${userId}`,
      course_id: `eq.${courseId}`,
      limit: '1'
    });

    const previous = existing[0] || null;
    const rows = await upsertRows(ENTITLEMENTS_TABLE, [{
      user_id: userId,
      course_id: courseId,
      plan_code: normalizePlanCode(previous && previous.plan_code || courseId),
      status: 'revoked',
      granted_by: context.user.id,
      granted_at: new Date().toISOString(),
      expires_at: new Date().toISOString(),
      notes,
      updated_at: new Date().toISOString()
    }], 'user_id,course_id');

    await insertAuditLog({
      actorUserId: context.user.id,
      subjectUserId: userId,
      action: 'revoke-entitlement',
      payload: { courseId, notes }
    });

    sendJson(res, 200, {
      ok: true,
      entitlement: rows[0] ? {
        courseId: normalizeCourseScope(rows[0].course_id),
        planCode: normalizePlanCode(rows[0].plan_code),
        status: normalizeEntitlementStatus(rows[0].status),
        grantedAt: normalizeIsoDate(rows[0].granted_at),
        expiresAt: normalizeIsoDate(rows[0].expires_at),
        notes: String(rows[0].notes || '')
      } : null
    });
  } catch (error) {
    sendJson(res, toStatusCode(error), { ok: false, error: toErrorMessage(error) });
  }
}

async function handleTeaserUpsert(req, res) {
  if (!isBackendConfigured()) {
    sendJson(res, 503, { ok: false, error: 'Backend admin no configurado en este entorno.' });
    return;
  }

  try {
    const context = await requireAdminContext(req);
    const body = await readJsonBody(req);
    const courseId = normalizeCourseId(body.courseId);
    const topicId = normalizeTopicId(body.topicId);
    const kind = normalizeTeaserKind(body.kind);
    const isPublic = body.isPublic !== false;
    const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;

    if (!courseId || !topicId) {
      const error = new Error('courseId y topicId son obligatorios.');
      error.statusCode = 400;
      throw error;
    }

    const rows = await upsertRows(TEASERS_TABLE, [{
      course_id: courseId,
      topic_id: topicId,
      kind,
      is_public: isPublic,
      sort_order: sortOrder,
      updated_at: new Date().toISOString()
    }], 'course_id,topic_id');

    await insertAuditLog({
      actorUserId: context.user.id,
      subjectUserId: null,
      action: 'teaser-upsert',
      payload: { courseId, topicId, kind, isPublic, sortOrder }
    });

    const row = rows[0] || null;
    sendJson(res, 200, {
      ok: true,
      teaser: row ? {
        courseId: normalizeCourseId(row.course_id),
        topicId: normalizeTopicId(row.topic_id),
        kind: normalizeTeaserKind(row.kind),
        isPublic: row.is_public !== false,
        sortOrder: Number(row.sort_order || 0)
      } : {
        courseId,
        topicId,
        kind,
        isPublic,
        sortOrder
      }
    });
  } catch (error) {
    sendJson(res, toStatusCode(error), { ok: false, error: toErrorMessage(error) });
  }
}

async function insertAuditLog(entry) {
  await upsertRows(AUDIT_TABLE, [{
    actor_user_id: entry.actorUserId || null,
    subject_user_id: entry.subjectUserId || null,
    action: String(entry.action || '').trim() || 'unknown',
    payload: entry.payload && typeof entry.payload === 'object' ? entry.payload : {},
    created_at: new Date().toISOString()
  }]);
}
