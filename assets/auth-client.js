(function () {
  const STORAGE_SESSION = 'sma:auth:session:v1';
  const STORAGE_USER = 'sma:auth:user:v1';
  const STORAGE_CLOUD_PROFILE = 'sma:cloud:profile:v1';

  function normalizeToken(value) {
    const token = String(value || '').trim();
    if (!token || token.length > 4096) return '';
    return token;
  }

  function normalizeSession(session) {
    const source = session && typeof session === 'object' ? session : null;
    if (!source) return null;
    const accessToken = normalizeToken(source.accessToken || source.access_token || source.token);
    if (!accessToken) return null;
    const refreshToken = normalizeToken(source.refreshToken || source.refresh_token || source.refresh);
    const tokenType = String(source.tokenType || source.token_type || 'bearer').trim().toLowerCase();
    return Object.assign({}, source, {
      accessToken: accessToken,
      refreshToken: refreshToken || '',
      tokenType: tokenType || 'bearer'
    });
  }

  function decodeJwtPayload(token) {
    const raw = String(token || '').trim();
    if (!raw) return null;
    const parts = raw.split('.');
    if (parts.length < 2) return null;
    const payload = String(parts[1] || '').replace(/-/g, '+').replace(/_/g, '/');
    const padding = payload.length % 4;
    const normalized = padding ? payload + new Array(5 - padding).join('=') : payload;
    try {
      return JSON.parse(decodeURIComponent(escape(atob(normalized))));
    } catch (_error) {
      return null;
    }
  }

  function normalizeUserFromToken(token) {
    const payload = decodeJwtPayload(token);
    if (!payload || typeof payload !== 'object') return null;
    return normalizeUser({
      id: payload.sub || payload.user_id || payload.uid || '',
      email: payload.email || payload.user_email || payload.preferred_username || ''
    });
  }

  function normalizeUser(user) {
    const source = user && typeof user === 'object' ? user : null;
    const id = String(source && (source.id || source.user_id || source.sub || '')).trim();
    if (!id) return null;
    return {
      id: id,
      email: String(source && (source.email || '')).trim().toLowerCase()
    };
  }

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_error) {
      return null;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function clearAuth() {
    localStorage.removeItem(STORAGE_SESSION);
    localStorage.removeItem(STORAGE_USER);
    localStorage.removeItem(STORAGE_CLOUD_PROFILE);
    dispatchChange();
  }

  function getSession() {
    const rawSession = readJson(STORAGE_SESSION);
    const session = normalizeSession(rawSession);
    if (!session) return null;
    if (rawSession && rawSession.accessToken !== session.accessToken) {
      writeJson(STORAGE_SESSION, session);
    }
    return session;
  }

  function getUser() {
    const user = readJson(STORAGE_USER);
    const normalized = normalizeUser(user);
    if (normalized) return normalized;
    const session = getSession();
    return normalizeUserFromToken(session && session.accessToken || null);
  }

  function saveAuth(payload) {
    const normalizedUser = normalizeUser(payload && payload.user);
    const normalizedSession = normalizeSession(payload && payload.session);
    if (normalizedUser) writeJson(STORAGE_USER, normalizedUser);
    if (normalizedSession) writeJson(STORAGE_SESSION, normalizedSession);
    dispatchChange();
  }

  function dispatchChange() {
    window.dispatchEvent(new CustomEvent('sma:auth-changed', {
      detail: {
        user: getUser(),
        session: getSession()
      }
    }));
  }

  function apiUrl(route) {
    return `/api/auth-sync?route=${encodeURIComponent(String(route || ''))}`;
  }

  async function call(route, method, body, accessToken) {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    const resolvedAccessToken = normalizeToken(accessToken);
    if (resolvedAccessToken) headers.Authorization = `Bearer ${resolvedAccessToken}`;

    const response = await fetch(apiUrl(route), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json().catch(function () { return null; });
    if (!response.ok || !payload || payload.ok === false) {
      const message = payload && payload.error ? String(payload.error) : `Error ${response.status}`;
      const error = new Error(message);
      error.statusCode = response.status;
      throw error;
    }
    return payload;
  }

  async function config() {
    return await call('config', 'GET');
  }

  async function signup(input) {
    const payload = await call('signup', 'POST', {
      email: String(input && input.email || '').trim(),
      password: String(input && input.password || ''),
      emailRedirectTo: String(input && input.emailRedirectTo || '').trim()
    });
    if (payload && normalizeUser(payload.user) && normalizeSession(payload.session)) {
      saveAuth(payload);
    }
    return payload;
  }

  async function login(input) {
    const payload = await call('login', 'POST', {
      email: String(input && input.email || '').trim(),
      password: String(input && input.password || '')
    });
    saveAuth(payload);
    return payload;
  }

  async function refresh() {
    const session = getSession();
    if (!session || !session.refreshToken) {
      throw new Error('No hay refresh token disponible.');
    }
    const payload = await call('refresh', 'POST', {
      refreshToken: session.refreshToken
    });
    saveAuth(payload);
    return payload;
  }

  async function resendConfirmation(input) {
    return await call('resend', 'POST', {
      email: String(input && input.email || '').trim(),
      emailRedirectTo: String(input && input.emailRedirectTo || '').trim()
    });
  }

  async function recoverPassword(input) {
    return await call('recover', 'POST', {
      email: String(input && input.email || '').trim(),
      emailRedirectTo: String(input && input.emailRedirectTo || '').trim()
    });
  }

  async function me() {
    const session = getSession();
    if (!session || !session.accessToken) {
      throw new Error('No hay sesión activa.');
    }
    const payload = await call('me', 'GET', null, session.accessToken);
    const normalizedUser = normalizeUser(payload.user);
    if (normalizedUser) {
      writeJson(STORAGE_USER, normalizedUser);
      dispatchChange();
    }
    return payload;
  }

  async function logout() {
    const session = getSession();
    if (session && session.accessToken) {
      try {
        await call('logout', 'POST', {}, session.accessToken);
      } catch (_error) {
      }
    }
    clearAuth();
  }

  window.SMAAuth = {
    keys: {
      session: STORAGE_SESSION,
      user: STORAGE_USER
    },
    config,
    signup,
    login,
    refresh,
    resendConfirmation,
    recoverPassword,
    me,
    logout,
    clearAuth,
    getUser,
    getSession,
    isLoggedIn: function () {
      return !!(getSession() && getUser());
    }
  };
})();
