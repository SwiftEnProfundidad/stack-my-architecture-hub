(function () {
  'use strict';

  var USER_KEY = 'sma:auth:user:v1';
  var SESSION_KEY = 'sma:auth:session:v1';
  var CLOUD_PROFILE_KEY = 'sma:cloud:profile:v1';

  function readJsonFromStorage(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_error) {
      return null;
    }
  }

  function isLocalContext() {
    var host = String(window.location.hostname || '').toLowerCase();
    if (window.location.protocol === 'file:') return true;
    if (!host) return false;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') return true;
    if (host.endsWith('.local') || host.endsWith('.nip.io')) return true;
    if (/^10\./.test(host) || /^192\.168\./.test(host)) return true;
    var private172 = host.match(/^172\.(\d{1,3})\./);
    if (!private172) return false;
    var secondOctet = Number(private172[1]);
    return Number.isFinite(secondOctet) && secondOctet >= 16 && secondOctet <= 31;
  }

  function isFiniteSafe(value) {
    return Number.isFinite(value);
  }

  function normalizeToken(value) {
    var token = String(value || '').trim();
    if (!token || token.length > 4096) return '';
    return token;
  }

  function decodeJwtPayload(token) {
    var parts = String(token).split('.');
    if (parts.length < 2 || !parts[1]) return null;
    var payload = String(parts[1]).replace(/-/g, '+').replace(/_/g, '/');
    var pad = payload.length % 4;
    if (pad) payload += new Array(5 - pad).join('=');
    try {
      return JSON.parse(decodeURIComponent(escape(atob(payload))));
    } catch (_error) {
      return null;
    }
  }

  function isExpiredByExpiresAt(expiresAtValue) {
    if (!expiresAtValue) return false;
    var expiresAt = Date.parse(String(expiresAtValue));
    return isFiniteSafe(expiresAt) && expiresAt <= Date.now();
  }

  function isExpiredByJwt(token) {
    var payload = decodeJwtPayload(token);
    if (!payload || typeof payload !== 'object') return true;
    if (!payload.exp) return false;
    var expAt = Number(payload.exp) * 1000;
    if (!isFiniteSafe(expAt)) return true;
    return expAt <= Date.now();
  }

  function isValidSession(user, session) {
    if (!user || !session) return false;
    var normalizedUserId = String(user.id || '').trim();
    if (!normalizedUserId) return false;
    var token = normalizeToken(session.accessToken);
    if (!token) return false;
    if (isExpiredByExpiresAt(session.expiresAt)) return false;
    if (isExpiredByJwt(token)) return false;
    var payload = decodeJwtPayload(token);
    var jwtSubject = payload && (payload.sub || payload.user_id || payload.uid);
    if (jwtSubject && String(jwtSubject) !== normalizedUserId) return false;
    return true;
  }

  function redirectToLogin() {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(CLOUD_PROFILE_KEY);

    var next = window.location.pathname + window.location.search + window.location.hash;
    var login = new URL('/auth/login.html', window.location.origin);
    login.searchParams.set('next', next);
    window.location.replace(login.pathname + login.search + login.hash);
  }

  try {
    if (isLocalContext()) return;

    var user = readJsonFromStorage(USER_KEY);
    var session = readJsonFromStorage(SESSION_KEY);

    if (isValidSession(user, session)) {
      return;
    }

    redirectToLogin();
  } catch (_error) {
    redirectToLogin();
  }
})();
