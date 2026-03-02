(function () {
  const STORAGE_SESSION = 'sma:auth:session:v1';
  const STORAGE_USER = 'sma:auth:user:v1';

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
    dispatchChange();
  }

  function getSession() {
    const session = readJson(STORAGE_SESSION);
    if (!session || !session.accessToken) return null;
    return session;
  }

  function getUser() {
    const user = readJson(STORAGE_USER);
    if (!user || !user.id) return null;
    return user;
  }

  function saveAuth(payload) {
    const user = payload && payload.user && payload.user.id ? payload.user : null;
    const session = payload && payload.session && payload.session.accessToken ? payload.session : null;
    if (user) writeJson(STORAGE_USER, user);
    if (session) writeJson(STORAGE_SESSION, session);
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
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

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
    if (payload.user && payload.session && payload.session.accessToken) {
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
    if (payload.user && payload.user.id) {
      writeJson(STORAGE_USER, payload.user);
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
