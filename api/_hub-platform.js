'use strict';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const HUB_BOOTSTRAP_ADMIN_EMAILS = String(process.env.HUB_BOOTSTRAP_ADMIN_EMAILS || '');

const DEFAULT_ROLE_TABLE = 'hub_user_roles';
const DEFAULT_ENTITLEMENTS_TABLE = 'hub_course_entitlements';
const DEFAULT_TEASERS_TABLE = 'hub_course_teasers';
const DEFAULT_NOTES_TABLE = 'hub_student_notes';
const DEFAULT_BOOKMARKS_TABLE = 'hub_student_bookmarks';
const DEFAULT_AUDIT_TABLE = 'hub_admin_audit_log';

const COURSE_IDS = ['ios', 'android', 'sdd'];
const COURSE_STAGE_DEFINITIONS = {
  ios: [
    { id: 'core-mobile', label: 'Etapa 0 · Core Mobile', prefixes: ['00-core-mobile'] },
    { id: 'junior', label: 'Etapa 1 · Junior', prefixes: ['01-fundamentos'] },
    { id: 'midlevel', label: 'Etapa 2 · Midlevel', prefixes: ['02-integracion'] },
    { id: 'senior', label: 'Etapa 3 · Senior', prefixes: ['03-evolucion'] },
    { id: 'architect', label: 'Etapa 4 · Arquitecto', prefixes: ['04-arquitecto'] },
    { id: 'mastery', label: 'Etapa 5 · Maestría', prefixes: ['05-maestria'] },
    { id: 'final-project', label: 'Etapa 6 · Proyecto final', prefixes: ['06-proyecto-final'] }
  ],
  android: [
    { id: 'core-mobile', label: 'Etapa 0 · Core Mobile', prefixes: ['00-core-mobile'] },
    { id: 'nivel-cero', label: 'Etapa 1 · Nivel Cero', prefixes: ['00-nivel-cero'] },
    { id: 'junior', label: 'Etapa 2 · Junior', prefixes: ['01-junior'] },
    { id: 'midlevel', label: 'Etapa 3 · Midlevel', prefixes: ['02-midlevel'] },
    { id: 'senior', label: 'Etapa 4 · Senior', prefixes: ['03-senior'] },
    { id: 'mastery', label: 'Etapa 5 · Maestría', prefixes: ['04-maestria'] },
    { id: 'final-project', label: 'Etapa 6 · Proyecto final', prefixes: ['05-proyecto-final'] }
  ],
  sdd: [
    { id: 'roadmap', label: 'Bloque 0 · Roadmap', prefixes: ['01-roadmap'] },
    { id: 'foundations', label: 'Bloque 1 · Semanas 1-4', prefixes: ['02-semana-01', '03-semana-02', '04-semana-03', '05-semana-04'] },
    { id: 'delivery', label: 'Bloque 2 · Semanas 5-8', prefixes: ['06-semana-05', '07-semana-06', '08-semana-07', '09-semana-08'] },
    { id: 'governance', label: 'Bloque 3 · Semanas 9-12', prefixes: ['10-semana-09', '11-semana-10', '12-semana-11', '13-semana-12'] },
    { id: 'hardening', label: 'Bloque 4 · Semanas 13-16', prefixes: ['14-semana-13', '15-semana-14', '16-semana-15', '17-semana-16'] },
    { id: 'annexes', label: 'Bloque 5 · Anexos y soporte', prefixes: ['anexos', '18-proyecto-final'] }
  ]
};
const ROLE_VALUES = ['student', 'trial', 'admin'];
const ENTITLEMENT_STATUS_VALUES = ['active', 'revoked', 'expired', 'trial'];
const TEASER_KIND_VALUES = ['course_overview', 'lesson'];
const MAX_COURSE_ID_LEN = 64;
const MAX_TOPIC_ID_LEN = 256;
const MAX_PLAN_CODE_LEN = 64;
const MAX_NOTE_LEN = 40000;

function isBackendConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function supabaseBaseUrl() {
  return SUPABASE_URL;
}

function supabaseServiceKey() {
  return SUPABASE_SERVICE_ROLE_KEY;
}

function supabaseRestBase() {
  return `${supabaseBaseUrl()}/rest/v1`;
}

function supabaseAuthBase() {
  return `${supabaseBaseUrl()}/auth/v1`;
}

function sendJson(res, statusCode, payload) {
  res.status(statusCode);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
}

function parseQuery(url) {
  const value = String(url || '/');
  const index = value.indexOf('?');
  if (index < 0) return {};
  const params = new URLSearchParams(value.slice(index + 1));
  const output = {};
  params.forEach((v, k) => {
    output[k] = v;
  });
  return output;
}

function resolveRoute(req) {
  const query = parseQuery(req.url);
  const route = String(query.route || '').trim().toLowerCase();
  if (route) return route;
  const pathname = String(req.url || '').split('?')[0].toLowerCase();
  if (pathname.endsWith('/config')) return 'config';
  if (pathname.endsWith('/me')) return 'me';
  if (pathname.endsWith('/access')) return 'access';
  if (pathname.endsWith('/list')) return 'list';
  if (pathname.endsWith('/toggle')) return 'toggle';
  if (pathname.endsWith('/upsert')) return 'upsert';
  return '';
}

async function readJsonBody(req) {
  if (req && req.body && typeof req.body === 'object') return req.body;
  const raw = await readRawBody(req);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function readRawBody(req) {
  return new Promise((resolve) => {
    if (!req || typeof req.on !== 'function') {
      resolve('');
      return;
    }
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > MAX_NOTE_LEN * 2) {
        raw = raw.slice(0, MAX_NOTE_LEN * 2);
      }
    });
    req.on('end', () => resolve(raw));
    req.on('error', () => resolve(''));
  });
}

function hasHeader(headers, key) {
  const target = String(key || '').toLowerCase();
  return Object.keys(headers || {}).some((name) => String(name).toLowerCase() === target);
}

function readHeader(req, name) {
  if (!req || !req.headers) return '';
  const key = String(name || '').toLowerCase();
  const direct = req.headers[key];
  if (direct !== undefined) return direct;
  const found = Object.keys(req.headers).find((item) => String(item).toLowerCase() === key);
  return found ? req.headers[found] : '';
}

function readBearerToken(req) {
  const header = String(readHeader(req, 'authorization') || '').trim();
  if (!header) return '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return '';
  const token = String(match[1] || '').trim();
  if (!token || token.length > 4096) return '';
  return token;
}

function normalizeTableName(value, fallback) {
  const raw = String(value || '').trim();
  if (!raw || !/^[A-Za-z0-9_]+$/.test(raw)) return fallback;
  return raw;
}

function normalizeCourseId(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw.length > MAX_COURSE_ID_LEN) return '';
  return COURSE_IDS.includes(raw) ? raw : '';
}

function normalizeCourseScope(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw.length > MAX_COURSE_ID_LEN) return '';
  if (raw === 'all') return raw;
  return COURSE_IDS.includes(raw) ? raw : '';
}

function normalizeTopicId(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.length > MAX_TOPIC_ID_LEN) return '';
  return raw;
}

function normalizePlanCode(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw.length > MAX_PLAN_CODE_LEN) return '';
  return raw;
}

function normalizeRole(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!ROLE_VALUES.includes(raw)) return 'student';
  return raw;
}

function normalizeEntitlementStatus(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!ENTITLEMENT_STATUS_VALUES.includes(raw)) return 'active';
  return raw;
}

function normalizeTeaserKind(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!TEASER_KIND_VALUES.includes(raw)) return 'lesson';
  return raw;
}

function normalizeIsoDate(value) {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normalizeUuid(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(raw)) return '';
  return raw;
}

function normalizeNoteContent(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.length > MAX_NOTE_LEN) return raw.slice(0, MAX_NOTE_LEN);
  return raw;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readSupabaseError(payload) {
  if (!payload || typeof payload !== 'object') return '';
  return [payload.message, payload.error, payload.hint, payload.details]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join(' | ');
}

function toStatusCode(error) {
  const code = Number(error && error.statusCode);
  if (Number.isInteger(code) && code >= 100 && code <= 599) return code;
  return 500;
}

function toErrorMessage(error) {
  return String((error && error.message) || 'Error inesperado.');
}

function isMissingRelationError(error) {
  const message = toErrorMessage(error);
  return /relation .* does not exist|could not find the table|does not exist in the schema/i.test(message);
}

function withSupabaseHeaders(options) {
  const key = supabaseServiceKey();
  const headers = Object.assign({
    apikey: key,
    Authorization: `Bearer ${key}`
  }, options.headers || {});
  if (options.body && !hasHeader(headers, 'content-type')) {
    headers['Content-Type'] = 'application/json';
  }
  return Object.assign({}, options, { headers });
}

async function fetchSupabaseJson(url, options = {}) {
  const response = await fetch(url, withSupabaseHeaders(options));
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (_error) {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(readSupabaseError(payload) || `Supabase respondió ${response.status}.`);
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}

async function fetchOptionalRows(table, params) {
  try {
    return await fetchRows(table, params);
  } catch (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
}

async function fetchRows(table, params) {
  const query = new URLSearchParams(params || {});
  const url = `${supabaseRestBase()}/${table}?${query.toString()}`;
  const payload = await fetchSupabaseJson(url, { method: 'GET' });
  return Array.isArray(payload) ? payload : [];
}

async function upsertRows(table, rows, onConflict) {
  const query = new URLSearchParams();
  if (onConflict) query.set('on_conflict', onConflict);
  const url = `${supabaseRestBase()}/${table}${query.toString() ? `?${query.toString()}` : ''}`;
  const payload = await fetchSupabaseJson(url, {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify(rows)
  });
  return Array.isArray(payload) ? payload : [];
}

async function deleteRows(table, filters) {
  const query = new URLSearchParams(filters || {});
  const url = `${supabaseRestBase()}/${table}?${query.toString()}`;
  const payload = await fetchSupabaseJson(url, {
    method: 'DELETE',
    headers: {
      Prefer: 'return=representation'
    }
  });
  return Array.isArray(payload) ? payload : [];
}

async function resolveAuthenticatedUser(req, { optional = false } = {}) {
  const bearer = readBearerToken(req);
  if (!bearer) {
    if (optional) return null;
    const error = new Error('Se requiere sesión autenticada.');
    error.statusCode = 401;
    throw error;
  }

  try {
    return await fetchSupabaseJson(`${supabaseAuthBase()}/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${bearer}`
      }
    });
  } catch (error) {
    if (optional && toStatusCode(error) === 401) return null;
    const next = new Error(toErrorMessage(error));
    next.statusCode = toStatusCode(error);
    throw next;
  }
}

function readBootstrapAdminEmails() {
  return HUB_BOOTSTRAP_ADMIN_EMAILS
    .split(',')
    .map((item) => String(item || '').trim().toLowerCase())
    .filter(Boolean);
}

function isBootstrapAdminEmail(email) {
  return readBootstrapAdminEmails().includes(String(email || '').trim().toLowerCase());
}

async function fetchUserRole(user, roleTable) {
  if (!user || !user.id) return 'anonymous';
  if (isBootstrapAdminEmail(user.email)) return 'admin';

  const rows = await fetchOptionalRows(roleTable, {
    select: 'role',
    user_id: `eq.${normalizeUuid(user.id) || user.id}`,
    limit: '1'
  });
  const row = rows[0] || null;
  if (!row) return 'student';
  return normalizeRole(row.role);
}

async function fetchUserEntitlements(userId, entitlementsTable) {
  if (!userId) return [];
  const rows = await fetchOptionalRows(entitlementsTable, {
    select: 'id,course_id,plan_code,status,granted_at,expires_at,notes',
    user_id: `eq.${normalizeUuid(userId) || userId}`,
    order: 'course_id.asc'
  });

  const now = Date.now();
  return rows
    .map((row) => ({
      id: String(row.id || ''),
      courseId: normalizeCourseScope(row.course_id),
      planCode: normalizePlanCode(row.plan_code),
      status: normalizeEntitlementStatus(row.status),
      grantedAt: normalizeIsoDate(row.granted_at),
      expiresAt: normalizeIsoDate(row.expires_at),
      notes: String(row.notes || '')
    }))
    .filter((row) => row.courseId)
    .filter((row) => row.status === 'active' || row.status === 'trial')
    .filter((row) => !row.expiresAt || Date.parse(row.expiresAt) > now);
}

async function fetchCourseTeasers(courseId, teasersTable) {
  const normalizedCourseId = normalizeCourseId(courseId);
  if (!normalizedCourseId) return [];
  const rows = await fetchOptionalRows(teasersTable, {
    select: 'topic_id,kind,is_public,sort_order',
    course_id: `eq.${normalizedCourseId}`,
    is_public: 'eq.true',
    order: 'sort_order.asc,topic_id.asc'
  });
  return rows
    .map((row) => ({
      topicId: normalizeTopicId(row.topic_id),
      kind: normalizeTeaserKind(row.kind),
      sortOrder: Number(row.sort_order || 0),
      isPublic: row.is_public !== false
    }))
    .filter((row) => row.topicId && row.isPublic);
}

async function resolveUserContext(req, options = {}) {
  const roleTable = normalizeTableName(options.roleTable, DEFAULT_ROLE_TABLE);
  const entitlementsTable = normalizeTableName(options.entitlementsTable, DEFAULT_ENTITLEMENTS_TABLE);
  const user = await resolveAuthenticatedUser(req, { optional: true });
  if (!user) {
    return {
      authenticated: false,
      user: null,
      role: 'anonymous',
      entitlements: []
    };
  }

  const role = await fetchUserRole(user, roleTable);
  const entitlements = role === 'admin'
    ? COURSE_IDS.map((courseId) => ({
      id: `admin-${courseId}`,
      courseId,
      planCode: 'admin',
      status: 'active',
      grantedAt: null,
      expiresAt: null,
      notes: ''
    }))
    : await fetchUserEntitlements(user.id, entitlementsTable);

  return {
    authenticated: true,
    user: {
      id: String(user.id || ''),
      email: String(user.email || '')
    },
    role,
    entitlements
  };
}

function hasFullCourseAccess(context, courseId) {
  if (!context || context.role === 'admin') return true;
  return (context.entitlements || []).some((item) => (
    (item.courseId === courseId || item.courseId === 'all') && item.status === 'active'
  ));
}

function mapAllowedCourses(context) {
  if (!context || context.role === 'admin') return COURSE_IDS.slice();
  const values = new Set();
  (context.entitlements || []).forEach((item) => {
    if (item.status !== 'active') return;
    if (item.courseId === 'all') {
      COURSE_IDS.forEach((courseId) => values.add(courseId));
      return;
    }
    if (COURSE_IDS.includes(item.courseId)) values.add(item.courseId);
  });
  return COURSE_IDS.filter((item) => values.has(item));
}

function inferCourseStageSummary(courseId, data) {
  const stages = COURSE_STAGE_DEFINITIONS[normalizeCourseId(courseId)] || [];
  if (!stages.length) {
    return {
      currentStageId: '',
      currentStageLabel: 'Ruta principal',
      completedCheckpoints: 0,
      totalCheckpoints: 0,
      nextStageLabel: null
    };
  }

  const safeData = data && typeof data === 'object' ? data : {};
  const completed = safeData.completed && typeof safeData.completed === 'object' ? Object.keys(safeData.completed) : [];
  const review = safeData.review && typeof safeData.review === 'object' ? Object.keys(safeData.review) : [];
  const lastTopic = normalizeTopicId(safeData.lastTopic);
  const activityTopics = new Set([...completed, ...review]);
  if (lastTopic) activityTopics.add(lastTopic);

  let highestStageIndex = -1;
  Array.from(activityTopics).forEach((topicId) => {
    const matchedIndex = stages.findIndex((stage) => stage.prefixes.some((prefix) => String(topicId || '').startsWith(prefix)));
    if (matchedIndex > highestStageIndex) highestStageIndex = matchedIndex;
  });

  const currentStageIndex = highestStageIndex >= 0 ? highestStageIndex : 0;
  const currentStage = stages[currentStageIndex] || stages[0];
  const nextStage = stages[currentStageIndex + 1] || null;

  return {
    currentStageId: currentStage.id,
    currentStageLabel: currentStage.label,
    completedCheckpoints: Math.max(0, currentStageIndex),
    totalCheckpoints: stages.length,
    nextStageLabel: nextStage ? nextStage.label : null
  };
}

async function resolveCourseAccess({ req, courseId, topicId, roleTable, entitlementsTable, teasersTable }) {
  const normalizedCourseId = normalizeCourseId(courseId);
  if (!normalizedCourseId) {
    const error = new Error('courseId es obligatorio y debe ser válido.');
    error.statusCode = 400;
    throw error;
  }

  const context = await resolveUserContext(req, { roleTable, entitlementsTable });
  const teasers = await fetchCourseTeasers(normalizedCourseId, normalizeTableName(teasersTable, DEFAULT_TEASERS_TABLE));
  const teaserTopicIds = teasers.map((item) => item.topicId);
  const normalizedTopicId = normalizeTopicId(topicId);
  const fullAccess = hasFullCourseAccess(context, normalizedCourseId);

  if (fullAccess) {
    return {
      courseId: normalizedCourseId,
      authenticated: context.authenticated,
      role: context.role,
      access: 'full',
      allowed: true,
      fullAccess: true,
      teaserTopicIds,
      requestedTopicId: normalizedTopicId || null
    };
  }

  const teaserAllowed = normalizedTopicId
    ? teaserTopicIds.includes(normalizedTopicId)
    : teaserTopicIds.length > 0;

  return {
    courseId: normalizedCourseId,
    authenticated: context.authenticated,
    role: context.role,
    access: teaserAllowed ? 'teaser' : 'blocked',
    allowed: teaserAllowed,
    fullAccess: false,
    teaserTopicIds,
    requestedTopicId: normalizedTopicId || null
  };
}

module.exports = {
  COURSE_IDS,
  DEFAULT_ROLE_TABLE,
  DEFAULT_ENTITLEMENTS_TABLE,
  DEFAULT_TEASERS_TABLE,
  DEFAULT_NOTES_TABLE,
  DEFAULT_BOOKMARKS_TABLE,
  DEFAULT_AUDIT_TABLE,
  isBackendConfigured,
  supabaseAuthBase,
  setCorsHeaders,
  sendJson,
  parseQuery,
  resolveRoute,
  readJsonBody,
  fetchSupabaseJson,
  fetchRows,
  fetchOptionalRows,
  upsertRows,
  deleteRows,
  resolveAuthenticatedUser,
  resolveUserContext,
  resolveCourseAccess,
  mapAllowedCourses,
  inferCourseStageSummary,
  normalizeCourseId,
  normalizeCourseScope,
  normalizeTopicId,
  normalizePlanCode,
  normalizeEntitlementStatus,
  normalizeIsoDate,
  normalizeNoteContent,
  normalizeRole,
  normalizeTeaserKind,
  normalizeTableName,
  normalizeUuid,
  toStatusCode,
  toErrorMessage,
  isPlainObject
};
