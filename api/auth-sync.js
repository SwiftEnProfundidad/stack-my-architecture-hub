const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const SUPABASE_ANON_KEY = String(process.env.SUPABASE_ANON_KEY || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const MAX_EMAIL_LEN = 320;
const MIN_PASSWORD_LEN = 8;
const MAX_PASSWORD_LEN = 128;
const MAX_REDIRECT_URL_LEN = 2048;

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
      provider: 'supabase-auth',
      schemaVersion: 1,
      minPasswordLength: MIN_PASSWORD_LEN
    });
    return;
  }

  if (!isBackendConfigured()) {
    sendJson(res, 503, {
      ok: false,
      error: 'Backend de autenticación no configurado en este entorno.'
    });
    return;
  }

  if (route === 'signup' && req.method === 'POST') {
    await handleSignUp(req, res);
    return;
  }

  if (route === 'login' && req.method === 'POST') {
    await handleLogin(req, res);
    return;
  }

  if (route === 'refresh' && req.method === 'POST') {
    await handleRefresh(req, res);
    return;
  }

  if (route === 'resend' && req.method === 'POST') {
    await handleResend(req, res);
    return;
  }

  if (route === 'recover' && req.method === 'POST') {
    await handleRecover(req, res);
    return;
  }

  if (route === 'me' && req.method === 'GET') {
    await handleMe(req, res);
    return;
  }

  if (route === 'logout' && req.method === 'POST') {
    await handleLogout(req, res);
    return;
  }

  sendJson(res, 404, {
    ok: false,
    error: 'Ruta no encontrada para auth-sync.'
  });
};

async function handleSignUp(req, res) {
  const body = await readJsonBody(req);
  const email = normalizeEmail(body.email);
  const password = normalizePassword(body.password);
  const redirectTo = normalizeRedirectUrl(body.emailRedirectTo);

  if (!email || !password) {
    sendJson(res, 400, {
      ok: false,
      error: 'email y password son obligatorios.'
    });
    return;
  }

  const payload = {
    email,
    password
  };

  if (redirectTo) {
    payload.options = {
      emailRedirectTo: redirectTo
    };
  }

  try {
    const response = await fetchSupabaseJson(`${supabaseAuthBase()}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const normalized = normalizeAuthPayload(response);
    sendJson(res, 200, {
      ok: true,
      user: normalized.user,
      session: normalized.session,
      requiresEmailConfirmation: !normalized.session.accessToken
    });
  } catch (error) {
    sendJson(res, toStatusCode(error), {
      ok: false,
      error: toErrorMessage(error)
    });
  }
}

async function handleLogin(req, res) {
  const body = await readJsonBody(req);
  const email = normalizeEmail(body.email);
  const password = normalizePassword(body.password);

  if (!email || !password) {
    sendJson(res, 400, {
      ok: false,
      error: 'email y password son obligatorios.'
    });
    return;
  }

  try {
    const response = await fetchSupabaseJson(`${supabaseAuthBase()}/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    const normalized = normalizeAuthPayload(response);
    sendJson(res, 200, {
      ok: true,
      user: normalized.user,
      session: normalized.session,
      requiresEmailConfirmation: false
    });
  } catch (error) {
    sendJson(res, toStatusCode(error), {
      ok: false,
      error: toErrorMessage(error)
    });
  }
}

async function handleRefresh(req, res) {
  const body = await readJsonBody(req);
  const refreshToken = normalizeRefreshToken(body.refreshToken);
  if (!refreshToken) {
    sendJson(res, 400, {
      ok: false,
      error: 'refreshToken es obligatorio.'
    });
    return;
  }

  try {
    const response = await fetchSupabaseJson(`${supabaseAuthBase()}/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        refresh_token: refreshToken
      })
    });

    const normalized = normalizeAuthPayload(response);
    sendJson(res, 200, {
      ok: true,
      user: normalized.user,
      session: normalized.session
    });
  } catch (error) {
    sendJson(res, toStatusCode(error), {
      ok: false,
      error: toErrorMessage(error)
    });
  }
}

async function handleResend(req, res) {
  const body = await readJsonBody(req);
  const email = normalizeEmail(body.email);
  const redirectTo = normalizeRedirectUrl(body.emailRedirectTo);

  if (!email) {
    sendJson(res, 400, {
      ok: false,
      error: 'email es obligatorio.'
    });
    return;
  }

  const payload = {
    type: 'signup',
    email
  };

  if (redirectTo) {
    payload.options = {
      emailRedirectTo: redirectTo
    };
  }

  try {
    await fetchSupabaseJson(`${supabaseAuthBase()}/resend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    sendJson(res, 200, {
      ok: true,
      sent: true
    });
  } catch (error) {
    sendJson(res, toStatusCode(error), {
      ok: false,
      error: toErrorMessage(error)
    });
  }
}

async function handleRecover(req, res) {
  const body = await readJsonBody(req);
  const email = normalizeEmail(body.email);
  const redirectTo = normalizeRedirectUrl(body.emailRedirectTo);

  if (!email) {
    sendJson(res, 400, {
      ok: false,
      error: 'email es obligatorio.'
    });
    return;
  }

  const payload = {
    email
  };

  if (redirectTo) {
    payload.options = {
      redirectTo
    };
  }

  try {
    await fetchSupabaseJson(`${supabaseAuthBase()}/recover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    sendJson(res, 200, {
      ok: true,
      sent: true
    });
  } catch (error) {
    sendJson(res, toStatusCode(error), {
      ok: false,
      error: toErrorMessage(error)
    });
  }
}

async function handleMe(req, res) {
  const bearer = readBearerToken(req);
  if (!bearer) {
    sendJson(res, 401, {
      ok: false,
      error: 'Falta token de sesión.'
    });
    return;
  }

  try {
    const payload = await fetchSupabaseJson(`${supabaseAuthBase()}/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${bearer}`
      }
    });
    sendJson(res, 200, {
      ok: true,
      user: normalizeUser(payload)
    });
  } catch (error) {
    sendJson(res, toStatusCode(error), {
      ok: false,
      error: toErrorMessage(error)
    });
  }
}

async function handleLogout(req, res) {
  const bearer = readBearerToken(req);
  if (!bearer) {
    sendJson(res, 401, {
      ok: false,
      error: 'Falta token de sesión.'
    });
    return;
  }

  try {
    await fetchSupabaseJson(`${supabaseAuthBase()}/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bearer}`
      },
      body: JSON.stringify({})
    });
    sendJson(res, 200, {
      ok: true
    });
  } catch (error) {
    sendJson(res, toStatusCode(error), {
      ok: false,
      error: toErrorMessage(error)
    });
  }
}

function resolveRoute(req) {
  const query = parseQuery(req.url);
  const route = String(query.route || '').trim().toLowerCase();
  if (route) return route;
  const pathname = String(req.url || '').split('?')[0].toLowerCase();
  if (pathname.endsWith('/config')) return 'config';
  if (pathname.endsWith('/signup')) return 'signup';
  if (pathname.endsWith('/login')) return 'login';
  if (pathname.endsWith('/refresh')) return 'refresh';
  if (pathname.endsWith('/resend')) return 'resend';
  if (pathname.endsWith('/recover')) return 'recover';
  if (pathname.endsWith('/me')) return 'me';
  if (pathname.endsWith('/logout')) return 'logout';
  return '';
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

function isBackendConfigured() {
  return Boolean(SUPABASE_URL && supabasePublicKey());
}

function supabaseAuthBase() {
  return `${SUPABASE_URL}/auth/v1`;
}

function supabasePublicKey() {
  return SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY;
}

async function fetchSupabaseJson(url, options = {}) {
  const key = supabasePublicKey();
  const headers = Object.assign(
    {
      apikey: key
    },
    options.headers || {}
  );
  if (options.body && !hasHeader(headers, 'content-type')) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, Object.assign({}, options, { headers }));
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (_error) {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(readSupabaseError(payload) || `Supabase auth respondió ${response.status}.`);
    error.statusCode = response.status;
    throw error;
  }

  return payload || {};
}

function normalizeAuthPayload(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  return {
    user: normalizeUser(source.user || source),
    session: {
      accessToken: normalizeToken(source.access_token),
      refreshToken: normalizeRefreshToken(source.refresh_token),
      expiresIn: normalizeExpiresIn(source.expires_in),
      tokenType: normalizeTokenType(source.token_type)
    }
  };
}

function normalizeUser(input) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    id: String(source.id || '').trim(),
    email: normalizeEmail(source.email),
    emailConfirmedAt: normalizeIsoDate(source.email_confirmed_at)
  };
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL_LEN) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '';
  return email;
}

function normalizePassword(value) {
  const password = String(value || '');
  if (!password) return '';
  if (password.length < MIN_PASSWORD_LEN) return '';
  if (password.length > MAX_PASSWORD_LEN) return '';
  return password;
}

function normalizeRedirectUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.length > MAX_REDIRECT_URL_LEN) return '';
  try {
    const parsed = new URL(raw);
    if (!/^https?:$/.test(parsed.protocol)) return '';
    return parsed.toString();
  } catch (_error) {
    return '';
  }
}

function normalizeToken(value) {
  const token = String(value || '').trim();
  if (!token || token.length > 4096) return '';
  return token;
}

function normalizeRefreshToken(value) {
  const token = String(value || '').trim();
  if (!token || token.length > 4096) return '';
  return token;
}

function normalizeTokenType(value) {
  const tokenType = String(value || '').trim();
  if (!tokenType || tokenType.length > 64) return 'bearer';
  return tokenType.toLowerCase();
}

function normalizeExpiresIn(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  if (number <= 0) return 0;
  if (number > 60 * 60 * 24 * 365) return 0;
  return Math.round(number);
}

function normalizeIsoDate(value) {
  if (!value) return null;
  const date = new Date(String(value));
  const time = date.getTime();
  if (!Number.isFinite(time)) return null;
  return date.toISOString();
}

function readBearerToken(req) {
  const header = String(readHeader(req, 'authorization') || '').trim();
  if (!header) return '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return '';
  return normalizeToken(match[1]);
}

function readHeader(req, name) {
  if (!req || !req.headers) return '';
  const key = String(name || '').toLowerCase();
  const direct = req.headers[key];
  if (direct !== undefined) return direct;
  const mapKey = Object.keys(req.headers).find((item) => String(item).toLowerCase() === key);
  return mapKey ? req.headers[mapKey] : '';
}

function readSupabaseError(payload) {
  if (!payload || typeof payload !== 'object') return '';
  return String(
    payload.msg ||
    payload.message ||
    payload.error_description ||
    payload.error ||
    ''
  ).trim();
}

function hasHeader(headers, name) {
  const target = String(name || '').toLowerCase();
  return Object.keys(headers || {}).some((key) => String(key).toLowerCase() === target);
}

function toStatusCode(error) {
  const value = Number(error && error.statusCode);
  if (!Number.isFinite(value)) return 500;
  if (value < 400 || value > 599) return 500;
  return Math.floor(value);
}

function toErrorMessage(error) {
  if (!error || !error.message) return 'Error interno de auth-sync.';
  return String(error.message);
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
}

async function readJsonBody(req) {
  if (req && req.body && typeof req.body === 'object') {
    return req.body;
  }
  const chunks = [];
  await new Promise((resolve, reject) => {
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', resolve);
    req.on('error', reject);
  });
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_error) {
    throw createBadRequest('El body JSON no es válido.');
  }
}

function createBadRequest(message) {
  const error = new Error(String(message || 'Bad Request'));
  error.statusCode = 400;
  return error;
}
