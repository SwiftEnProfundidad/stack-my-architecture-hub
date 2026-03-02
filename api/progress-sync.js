const DEFAULT_TABLE = 'course_progress';
const MAX_DATA_BYTES = toInt(process.env.PROGRESS_SYNC_MAX_BYTES, 65536, 2048, 524288);
const MAX_PROFILE_KEY_LEN = 128;
const MAX_COURSE_ID_LEN = 128;
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const SUPABASE_ANON_KEY = String(process.env.SUPABASE_ANON_KEY || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const PROGRESS_SYNC_TABLE = normalizeTableName(String(process.env.PROGRESS_SYNC_TABLE || DEFAULT_TABLE).trim());

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
      maxDataBytes: MAX_DATA_BYTES
    });
    return;
  }

  if (route === 'state' && req.method === 'GET') {
    await handleStateGet(req, res);
    return;
  }

  if (route === 'state' && req.method === 'POST') {
    await handleStatePost(req, res);
    return;
  }

  sendJson(res, 404, {
    ok: false,
    error: 'Ruta no encontrada para progress-sync.'
  });
};

async function handleStateGet(req, res) {
  if (!isBackendConfigured()) {
    sendJson(res, 503, {
      ok: false,
      error: 'Backend de progreso no configurado en este entorno.'
    });
    return;
  }

  try {
    const query = parseQuery(req.url);
    const courseId = normalizeCourseId(query.courseId);
    const requestedProfileKey = normalizeProfileKey(query.profileKey);
    const authProfileKey = await resolveAuthorizedProfileKey(req);
    const profileKey = authProfileKey || requestedProfileKey;

    if (!courseId || !profileKey) {
      sendJson(res, 400, {
        ok: false,
        error: 'courseId y profileKey son obligatorios.'
      });
      return;
    }

    const state = await fetchProgressState(courseId, profileKey);
    sendJson(res, 200, {
      ok: true,
      authenticated: Boolean(authProfileKey),
      state: state || {
        courseId,
        profileKey,
        updatedAt: null,
        data: {}
      }
    });
  } catch (error) {
    sendJson(res, toStatusCode(error), {
      ok: false,
      error: toErrorMessage(error)
    });
  }
}

async function handleStatePost(req, res) {
  if (!isBackendConfigured()) {
    sendJson(res, 503, {
      ok: false,
      error: 'Backend de progreso no configurado en este entorno.'
    });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const courseId = normalizeCourseId(body.courseId);
    const requestedProfileKey = normalizeProfileKey(body.profileKey);
    const authProfileKey = await resolveAuthorizedProfileKey(req);
    const profileKey = authProfileKey || requestedProfileKey;
    const clientUpdatedAt = normalizeIsoDate(body.clientUpdatedAt);
    const data = sanitizeData(body.data);

    if (!courseId || !profileKey) {
      sendJson(res, 400, {
        ok: false,
        error: 'courseId y profileKey son obligatorios.'
      });
      return;
    }

    if (!data.ok) {
      sendJson(res, 400, {
        ok: false,
        error: data.error
      });
      return;
    }

    const state = await upsertProgressState({
      courseId,
      profileKey,
      clientUpdatedAt,
      data: data.value
    });

    sendJson(res, 200, {
      ok: true,
      authenticated: Boolean(authProfileKey),
      state
    });
  } catch (error) {
    sendJson(res, toStatusCode(error), {
      ok: false,
      error: toErrorMessage(error)
    });
  }
}

async function fetchProgressState(courseId, profileKey) {
  const query = new URLSearchParams({
    select: 'course_id,profile_key,updated_at,data',
    course_id: `eq.${courseId}`,
    profile_key: `eq.${profileKey}`,
    limit: '1'
  });

  const url = `${supabaseRestBase()}/${tableName()}?${query.toString()}`;
  const payload = await fetchSupabaseJson(url, { method: 'GET' });
  const row = Array.isArray(payload) && payload.length ? payload[0] : null;
  if (!row) return null;

  return {
    courseId: String(row.course_id || courseId),
    profileKey: String(row.profile_key || profileKey),
    updatedAt: normalizeIsoDate(row.updated_at) || null,
    data: isPlainObject(row.data) ? row.data : {}
  };
}

async function upsertProgressState({ courseId, profileKey, data, clientUpdatedAt }) {
  const now = new Date().toISOString();
  const body = [
    {
      course_id: courseId,
      profile_key: profileKey,
      updated_at: now,
      client_updated_at: clientUpdatedAt,
      data
    }
  ];

  const query = new URLSearchParams({ on_conflict: 'course_id,profile_key' });
  const url = `${supabaseRestBase()}/${tableName()}?${query.toString()}`;
  const payload = await fetchSupabaseJson(url, {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify(body)
  });

  const row = Array.isArray(payload) && payload.length ? payload[0] : null;
  if (!row) {
    return {
      courseId,
      profileKey,
      updatedAt: now,
      data
    };
  }

  return {
    courseId: String(row.course_id || courseId),
    profileKey: String(row.profile_key || profileKey),
    updatedAt: normalizeIsoDate(row.updated_at) || now,
    data: isPlainObject(row.data) ? row.data : data
  };
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

function withSupabaseHeaders(options) {
  const key = supabaseServiceKey();
  const baseHeaders = {
    apikey: key,
    Authorization: `Bearer ${key}`
  };
  const headers = Object.assign({}, baseHeaders, options.headers || {});
  if (options.body && !hasHeader(headers, 'content-type')) {
    headers['Content-Type'] = 'application/json';
  }
  return Object.assign({}, options, { headers });
}

function parseQuery(url) {
  const value = String(url || '/');
  const index = value.indexOf('?');
  if (index < 0) return {};
  const search = value.slice(index + 1);
  const params = new URLSearchParams(search);
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
  if (pathname.endsWith('/state')) return 'state';
  return '';
}

function sanitizeData(input) {
  if (!isPlainObject(input)) {
    return { ok: false, error: 'data debe ser un objeto JSON.' };
  }

  const cleaned = sanitizeNode(input, 0);
  if (!cleaned.ok) return cleaned;
  const serialized = JSON.stringify(cleaned.value);
  const bytes = Buffer.byteLength(serialized, 'utf8');
  if (bytes > MAX_DATA_BYTES) {
    return { ok: false, error: `El payload supera el límite de ${MAX_DATA_BYTES} bytes.` };
  }

  return { ok: true, value: cleaned.value };
}

function sanitizeNode(value, depth) {
  if (depth > 8) {
    return { ok: false, error: 'data supera profundidad máxima permitida.' };
  }

  if (value === null) return { ok: true, value: null };
  if (typeof value === 'string') return { ok: true, value: value.slice(0, 10000) };
  if (typeof value === 'number') return { ok: true, value: Number.isFinite(value) ? value : 0 };
  if (typeof value === 'boolean') return { ok: true, value };

  if (Array.isArray(value)) {
    if (value.length > 5000) {
      return { ok: false, error: 'data contiene demasiados elementos en arreglo.' };
    }
    const output = [];
    for (let i = 0; i < value.length; i += 1) {
      const item = sanitizeNode(value[i], depth + 1);
      if (!item.ok) return item;
      output.push(item.value);
    }
    return { ok: true, value: output };
  }

  if (!isPlainObject(value)) {
    return { ok: false, error: 'data contiene un tipo no soportado.' };
  }

  const keys = Object.keys(value);
  if (keys.length > 5000) {
    return { ok: false, error: 'data contiene demasiadas claves.' };
  }

  const output = {};
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (!isSafeKey(key)) continue;
    const item = sanitizeNode(value[key], depth + 1);
    if (!item.ok) return item;
    output[key] = item.value;
  }
  return { ok: true, value: output };
}

function isSafeKey(key) {
  if (!key || typeof key !== 'string') return false;
  if (key.length > 256) return false;
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') return false;
  return true;
}

function normalizeCourseId(value) {
  const courseId = String(value || '').trim();
  if (!courseId) return '';
  if (courseId.length > MAX_COURSE_ID_LEN) return '';
  if (!/^[A-Za-z0-9._-]+$/.test(courseId)) return '';
  return courseId;
}

function normalizeProfileKey(value) {
  const profileKey = String(value || '').trim();
  if (!profileKey) return '';
  if (profileKey.length > MAX_PROFILE_KEY_LEN) return '';
  if (!/^[A-Za-z0-9._:-]+$/.test(profileKey)) return '';
  return profileKey;
}

function normalizeIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function tableName() {
  return PROGRESS_SYNC_TABLE;
}

function supabaseBaseUrl() {
  return SUPABASE_URL;
}

function supabaseServiceKey() {
  return SUPABASE_SERVICE_ROLE_KEY;
}

function supabasePublicKey() {
  return SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY;
}

function supabaseRestBase() {
  return `${supabaseBaseUrl()}/rest/v1`;
}

function isBackendConfigured() {
  return Boolean(supabaseBaseUrl() && supabaseServiceKey());
}

async function resolveAuthorizedProfileKey(req) {
  const bearer = readBearerToken(req);
  if (!bearer) return '';
  const user = await fetchSupabaseAuthUser(bearer);
  const profileKey = normalizeProfileKey(user && user.id);
  if (!profileKey) {
    const error = new Error('Token inválido para sincronización autenticada.');
    error.statusCode = 401;
    throw error;
  }
  return profileKey;
}

async function fetchSupabaseAuthUser(accessToken) {
  const key = supabasePublicKey();
  if (!key) {
    const error = new Error('SUPABASE_ANON_KEY no configurada para validar sesión.');
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch(`${supabaseBaseUrl()}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`
    }
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (_error) {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(readSupabaseError(payload) || 'No se pudo validar sesión de usuario.');
    error.statusCode = response.status || 401;
    throw error;
  }

  return payload && typeof payload === 'object' ? payload : {};
}

function normalizeTableName(value) {
  if (!value) return DEFAULT_TABLE;
  if (!/^[A-Za-z0-9_]+$/.test(value)) return DEFAULT_TABLE;
  return value;
}

function readSupabaseError(payload) {
  if (!payload || typeof payload !== 'object') return '';
  const parts = [payload.message, payload.error, payload.hint, payload.details]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return parts.join(' | ');
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
      if (raw.length > MAX_DATA_BYTES * 2) {
        raw = raw.slice(0, MAX_DATA_BYTES * 2);
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

function readHeader(req, key) {
  if (!req || !req.headers) return '';
  const target = String(key || '').toLowerCase();
  const direct = req.headers[target];
  if (direct !== undefined) return direct;
  const original = Object.keys(req.headers).find((name) => String(name).toLowerCase() === target);
  return original ? req.headers[original] : '';
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

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}

function sendJson(res, statusCode, payload) {
  res.status(statusCode);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function toStatusCode(error) {
  const value = Number(error && error.statusCode);
  if (!Number.isFinite(value)) return 500;
  if (value < 400) return 500;
  if (value > 599) return 500;
  return Math.round(value);
}

function toErrorMessage(error) {
  if (!error) return 'Error interno al sincronizar progreso.';
  const message = String(error.message || '').trim();
  if (message) return message;
  return 'Error interno al sincronizar progreso.';
}

function toInt(raw, fallback, min, max) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  if (value < min) return min;
  if (value > max) return max;
  return Math.round(value);
}
