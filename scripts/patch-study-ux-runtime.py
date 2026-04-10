#!/usr/bin/env python3

from __future__ import annotations

import argparse
from pathlib import Path

COURSES = ("ios", "android", "sdd", "governance", "pumuki")
COURSE_HTML_TARGETS = (
    ("ios", "index.html"),
    ("ios", "curso-stack-my-architecture.html"),
    ("android", "index.html"),
    ("android", "curso-stack-my-architecture-android.html"),
    ("sdd", "index.html"),
    ("sdd", "curso-stack-my-architecture-sdd.html"),
    ("governance", "index.html"),
    ("governance", "curso-stack-my-architecture-governance.html"),
    ("pumuki", "index.html"),
    ("pumuki", "curso-stack-my-architecture-pumuki.html"),
)

INLINE_AUTH_GUARD = r"""<script>
(function () {
  try {
    var host = String(window.location.hostname || '').toLowerCase();
    var local172 = host.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
    var isLocal = window.location.protocol === 'file:' ||
      host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0' ||
      host.endsWith('.local') ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
      (local172 && Number(local172[1]) >= 16 && Number(local172[1]) <= 31);
    if (isLocal) return;

    var user = JSON.parse(localStorage.getItem('sma:auth:user:v1') || 'null');
    var session = JSON.parse(localStorage.getItem('sma:auth:session:v1') || 'null');
    var isValid = !!(user && user.id && session && session.accessToken);
    if (isValid && session.expiresAt) {
      var expiresAt = Date.parse(String(session.expiresAt));
      if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) isValid = false;
    }
    if (isValid) return;

    localStorage.removeItem('sma:auth:user:v1');
    localStorage.removeItem('sma:auth:session:v1');
    localStorage.removeItem('sma:cloud:profile:v1');
    var next = window.location.pathname + window.location.search + window.location.hash;
    var login = new URL('/auth/login.html', window.location.origin);
    login.searchParams.set('next', next);
    window.location.replace(login.pathname + login.search + login.hash);
  } catch (_error) {
    var next = window.location.pathname + window.location.search + window.location.hash;
    window.location.replace('/auth/login.html?next=' + encodeURIComponent(next));
  }
})();
</script>
"""

JS_REPLACEMENTS = [
    (
        """  const keyCloudEndpoint = 'sma:cloud:endpoint:v1';\n  const keyAuthSession = 'sma:auth:session:v1';\n  const keyAuthUser = 'sma:auth:user:v1';\n  const DEFAULT_REMOTE_PROGRESS_BASE = 'https://architecture-stack.vercel.app';\n  const canonicalCourseKey = normalizeCanonicalCourseKey(courseId);\n""",
        """  const keyCloudEndpoint = 'sma:cloud:endpoint:v1';\n  const keyAuthSession = 'sma:auth:session:v1';\n  const keyAuthUser = 'sma:auth:user:v1';\n  const DEFAULT_REMOTE_PROGRESS_BASE = 'https://architecture-stack.vercel.app';\n\n  function toApiUrl(path) {\n    const rawPath = String(path || '').trim();\n    if (!rawPath) return '/api';\n    let routePath = rawPath;\n    if (routePath.startsWith('/')) routePath = routePath.slice(1);\n    if (routePath.startsWith('api/')) routePath = routePath.slice(4);\n    if (isLocalContext()) {\n      return `/${routePath}`;\n    }\n    if (window.location.hostname === 'architecture-stack.vercel.app') {\n      return `/api/${routePath}`;\n    }\n    const q = routePath.indexOf('?');\n    const basePath = q >= 0 ? routePath.slice(0, q) : routePath;\n    const query = q >= 0 ? routePath.slice(q + 1) : '';\n    const normalized = String(basePath || '').replace(/^\\/+/g, '');\n    return `/api/proxy?path=${encodeURIComponent(normalized)}${query ? `&${query}` : ''}`;\n  }\n\n  const canonicalCourseKey = normalizeCanonicalCourseKey(courseId);\n""",
    ),
    (
        """          fetch(`/api/student-notes?route=list&courseId=${encodeURIComponent(courseId)}`, {\n            method: 'GET',\n            headers: headers\n          }),\n          fetch(`/api/student-bookmarks?route=list&courseId=${encodeURIComponent(courseId)}`, {\n            method: 'GET',\n            headers: headers\n          })\n""",
        """          fetch(toApiUrl(`/api/student-notes?route=list&courseId=${encodeURIComponent(courseId)}`), {\n            method: 'GET',\n            headers: headers\n          }),\n          fetch(toApiUrl(`/api/student-bookmarks?route=list&courseId=${encodeURIComponent(courseId)}`), {\n            method: 'GET',\n            headers: headers\n          })\n""",
    ),
    (
        """        const response = await fetch('/api/student-notes?route=upsert', {\n          method: 'POST',\n          headers: headers,\n          body: JSON.stringify({\n""",
        """        const response = await fetch(toApiUrl('/api/student-notes?route=upsert'), {\n          method: 'POST',\n          headers: headers,\n          body: JSON.stringify({\n""",
    ),
    (
        """        const response = await fetch('/api/student-bookmarks?route=toggle', {\n          method: 'POST',\n          headers: headers,\n          body: JSON.stringify({\n""",
        """        const response = await fetch(toApiUrl('/api/student-bookmarks?route=toggle'), {\n          method: 'POST',\n          headers: headers,\n          body: JSON.stringify({\n""",
    ),
    (
        """        const response = await fetch(`/api/entitlements?route=access&courseId=${encodeURIComponent(courseId)}`, {\n          method: 'GET',\n          headers: headers\n        });\n""",
        """        const response = await fetch(toApiUrl(`/api/entitlements?route=access&courseId=${encodeURIComponent(courseId)}`), {\n          method: 'GET',\n          headers: headers\n        });\n""",
    ),
    (
        """  function createAccessControl() {\n    const state = {\n      ready: false,\n      fullAccess: true,\n      mode: 'full',\n      teaserTopicIds: []\n    };\n""",
        """  function createAccessControl() {\n    const state = {\n      ready: false,\n      fullAccess: false,\n      mode: 'blocked',\n      teaserTopicIds: []\n    };\n""",
    ),
    (
        "      if (isLocalContext()) {\n        renderBanner();\n        updateLockedNavigation();\n        return;\n      }\n",
        "      if (isLocalContext()) {\n        state.fullAccess = true;\n        state.mode = 'active';\n        renderBanner();\n        updateLockedNavigation();\n        return;\n      }\n",
    ),
    (
        """      const access = await fetchCourseAccess();\n      if (!access) {\n        renderBanner();\n        updateLockedNavigation();\n        return;\n      }\n""",
        """      const hasAuthToken = Boolean(getAuthAccessToken());\n      const access = await fetchCourseAccess();\n      if (!access) {\n        state.mode = 'blocked';\n        state.fullAccess = false;\n        state.teaserTopicIds = [];\n        if (hasAuthToken) {\n          clearAuthState();\n          goAuthPortal();\n          return;\n        }\n        renderBanner();\n        updateLockedNavigation();\n        return;\n      }\n""",
    ),
    (
        """        if (!response.ok) return null;\n        const body = await response.json().catch(function () { return null; });\n        if (!body || !body.ok || !body.access || typeof body.access !== 'object') return null;\n        return body.access;\n      } catch (_error) {\n        return null;\n      }\n""",
        """        if (!response.ok) {\n        if ((response.status === 401 || response.status === 403) && bearer) {\n          clearAuthState();\n        }\n        return null;\n      }\n      const body = await response.json().catch(function () { return null; });\n      if (!body || !body.ok || !body.access || typeof body.access !== 'object') return null;\n      if (bearer && body.access.authenticated === false) {\n        clearAuthState();\n        return null;\n      }\n      return body.access;\n      } catch (_error) {\n        return null;\n      }\n""",
    ),
    (
        """  function getAuthAccessToken() {\n    const session = readJson(keyAuthSession, null);\n    if (!session || typeof session !== 'object') return '';\n    const token = String(session.accessToken || '').trim();\n    if (!token || token.length > 4096) return '';\n    return token;\n  }\n\n  function hasAuthenticatedCloudProfile() {\n""",
        """  function getAuthAccessToken() {\n    const session = readJson(keyAuthSession, null);\n    if (!session || typeof session !== 'object') return '';\n    const token = String(session.accessToken || '').trim();\n    if (!token || token.length > 4096) return '';\n    return token;\n  }\n\n  function clearAuthState() {\n    localStorage.removeItem(keyAuthSession);\n    localStorage.removeItem(keyAuthUser);\n    localStorage.removeItem(keyCloudProfile);\n  }\n\n  function hasAuthenticatedCloudProfile() {\n""",
    ),
    (
        """    const bookmarksCopy = document.createElement('p');\n    bookmarksCopy.textContent = 'Tus puntos guardados más recientes para volver rápido a temas importantes.';\n    const bookmarksList = document.createElement('div');\n    bookmarksList.id = 'study-bookmarks-list';\n    bookmarksList.className = 'study-bookmarks-list';\n    bookmarksBox.appendChild(bookmarksTitle);\n    bookmarksBox.appendChild(bookmarksCopy);\n    bookmarksBox.appendChild(bookmarksList);\n""",
        """    const bookmarksCopy = document.createElement('p');\n    bookmarksCopy.textContent = 'Tus puntos guardados más recientes para volver rápido a temas importantes.';\n    const bookmarksList = document.createElement('div');\n    bookmarksList.id = 'study-bookmarks-list';\n    bookmarksList.className = 'study-bookmarks-list';\n    const bookmarksStatus = document.createElement('p');\n    bookmarksStatus.id = 'study-bookmark-status';\n    bookmarksStatus.className = 'study-bookmark-status';\n    bookmarksBox.appendChild(bookmarksTitle);\n    bookmarksBox.appendChild(bookmarksCopy);\n    bookmarksBox.appendChild(bookmarksList);\n    bookmarksBox.appendChild(bookmarksStatus);\n""",
    ),
    (
        """    function renderBookmarksPanel() {\n      const list = document.getElementById('study-bookmarks-list');\n      if (!list) return;\n\n      if (!hasAuthenticatedCloudProfile()) {\n        list.innerHTML = '<p class=\\"study-bookmarks-empty\\">Inicia sesión para sincronizar bookmarks privados entre dispositivos.</p>';\n        return;\n      }\n""",
        """    function renderBookmarksPanel() {\n      const list = document.getElementById('study-bookmarks-list');\n      const status = document.getElementById('study-bookmark-status');\n      if (!list) return;\n\n      if (!hasAuthenticatedCloudProfile()) {\n        list.innerHTML = '<p class=\\"study-bookmarks-empty\\">Inicia sesión para sincronizar bookmarks privados entre dispositivos.</p>';\n        if (status) status.textContent = 'Los bookmarks cloud están disponibles solo con sesión activa.';\n        return;\n      }\n""",
    ),
    (
        """      if (!items.length) {\n        list.innerHTML = '<p class=\\"study-bookmarks-empty\\">Todavía no has guardado ningún bookmark.</p>';\n        return;\n      }\n\n      list.innerHTML = items.map(function (item) {\n""",
        """      if (!items.length) {\n        list.innerHTML = '<p class=\\"study-bookmarks-empty\\">Todavía no has guardado ningún bookmark.</p>';\n        if (status) status.textContent = 'Guarda un bookmark para volver rápido a una lección importante.';\n        return;\n      }\n\n      if (status) status.textContent = 'Tus bookmarks recientes quedan ligados a tu cuenta y se sincronizan entre dispositivos.';\n\n      list.innerHTML = items.map(function (item) {\n""",
    ),
    (
        """    async function toggleBookmark() {\n      if (!currentTopic) return;\n      if (!hasAuthenticatedCloudProfile()) {\n        goAuthPortal();\n        return;\n      }\n\n      try {\n""",
        """    async function toggleBookmark() {\n      if (!currentTopic) return;\n      if (!hasAuthenticatedCloudProfile()) {\n        goAuthPortal();\n        return;\n      }\n\n      const status = document.getElementById('study-bookmark-status');\n      try {\n""",
    ),
    (
        """        if (body.active) {\n          state.bookmarksByTopicId[currentTopic.id] = {\n            updatedAt: String(body.bookmark && body.bookmark.updatedAt || new Date().toISOString())\n          };\n        } else {\n          delete state.bookmarksByTopicId[currentTopic.id];\n        }\n        render();\n        scheduleDecorateNavStates();\n      } catch (_error) {\n      }\n""",
        """        if (body.active) {\n          state.bookmarksByTopicId[currentTopic.id] = {\n            updatedAt: String(body.bookmark && body.bookmark.updatedAt || new Date().toISOString())\n          };\n        } else {\n          delete state.bookmarksByTopicId[currentTopic.id];\n        }\n        if (status) {\n          status.textContent = body.active\n            ? `Bookmark guardado para ${currentTopic.lessonLabel || currentTopic.id}.`\n            : `Bookmark eliminado de ${currentTopic.lessonLabel || currentTopic.id}.`;\n        }\n        render();\n        scheduleDecorateNavStates();\n      } catch (error) {\n        if (status) status.textContent = error && error.message ? error.message : 'No se pudo actualizar el bookmark.';\n      }\n""",
    ),
]

CSS_REPLACEMENTS = [
    (
        """.study-interview-chip {\n  border: 1px solid rgba(96, 165, 250, 0.24);\n  border-radius: 999px;\n  background: rgba(15, 23, 42, 0.72);\n  color: var(--text, #e5e7eb);\n""",
        """.study-interview-chip {\n  border: 1px solid color-mix(in oklab, var(--accent, #60a5fa), var(--border, #334155) 55%);\n  border-radius: 999px;\n  background: color-mix(in oklab, var(--bg, #ffffff), var(--accent, #60a5fa) 8%);\n  color: var(--text, #111827);\n""",
    ),
    (
        """.study-interview-chip.is-active {\n  border-color: rgba(96, 165, 250, 0.42);\n  background: rgba(59, 130, 246, 0.18);\n}\n""",
        """.study-interview-chip.is-active {\n  border-color: color-mix(in oklab, var(--accent, #60a5fa), #ffffff 18%);\n  background: color-mix(in oklab, var(--accent, #60a5fa), var(--bg, #ffffff) 82%);\n}\n""",
    ),
    (
        """.study-interview-card {\n  display: grid;\n  gap: 14px;\n  border: 1px solid rgba(148, 163, 184, 0.18);\n  border-radius: 12px;\n  background: rgba(15, 23, 42, 0.82);\n  padding: 14px;\n}\n""",
        """.study-interview-card {\n  display: grid;\n  gap: 14px;\n  border: 1px solid color-mix(in oklab, var(--border, #334155), #ffffff 12%);\n  border-radius: 12px;\n  background: color-mix(in oklab, var(--bg, #ffffff), var(--bg-surface, #f6f8fa) 58%);\n  padding: 14px;\n  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);\n}\n""",
    ),
    (
        """.study-interview-source {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  min-height: 38px;\n  padding: 8px 12px;\n  border-radius: 10px;\n  border: 1px solid rgba(96, 165, 250, 0.28);\n  background: rgba(59, 130, 246, 0.12);\n  color: var(--text, #e5e7eb);\n""",
        """.study-interview-source {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  min-height: 38px;\n  padding: 8px 12px;\n  border-radius: 10px;\n  border: 1px solid color-mix(in oklab, var(--accent, #60a5fa), var(--border, #334155) 48%);\n  background: color-mix(in oklab, var(--accent, #60a5fa), var(--bg, #ffffff) 88%);\n  color: var(--text, #111827);\n""",
    ),
    (
        """.study-interview-empty {\n  margin: 0;\n  color: var(--text-secondary, #cbd5e1);\n}\n""",
        """.study-interview-empty {\n  margin: 0;\n  color: var(--text-secondary, #cbd5e1);\n}\n\n.study-bookmark-status {\n  margin: 0;\n  font-size: 0.82rem;\n  color: var(--text-secondary, #cbd5e1);\n}\n""",
    ),
]

ASSISTANT_PANEL_REPLACEMENTS = [
    (
        "    var KEY_DAILY_BUDGET = STORAGE_PREFIX + 'daily_budget_usd';",
        "    var KEY_DAILY_BUDGET = STORAGE_PREFIX + 'daily_budget_usd';\n    var KEY_API_KEY = STORAGE_PREFIX + 'api_key';",
    ),
    (
        "        softDailyBudgetUsd: Number(localStorage.getItem(KEY_DAILY_BUDGET) || 2.0),",
        "        softDailyBudgetUsd: Number(localStorage.getItem(KEY_DAILY_BUDGET) || 2.0),\n        apiKey: localStorage.getItem(KEY_API_KEY) || '',",
    ),
    (
        "        localStorage.setItem(KEY_DAILY_BUDGET, String(state.softDailyBudgetUsd));",
        "        localStorage.setItem(KEY_DAILY_BUDGET, String(state.softDailyBudgetUsd));\n        localStorage.setItem(KEY_API_KEY, state.apiKey);",
    ),
    (
        "        grid.appendChild(modelLabel);\n        grid.appendChild(tokensLabel);\n        grid.appendChild(dailyBudgetLabel);\n        grid.appendChild(proxyLabel);",
        "        var apiKeyLabel = document.createElement('label');\n        apiKeyLabel.textContent = 'API Key (OpenAI / proveedor)';\n        var apiKeyInput = document.createElement('input');\n        apiKeyInput.type = 'password';\n        apiKeyInput.autocomplete = 'off';\n        apiKeyInput.placeholder = 'sk-...';\n        apiKeyInput.value = state.apiKey;\n        apiKeyInput.addEventListener('change', function () {\n            state.apiKey = apiKeyInput.value.trim();\n            saveConfig();\n        });\n        apiKeyLabel.appendChild(apiKeyInput);\n\n        grid.appendChild(modelLabel);\n        grid.appendChild(tokensLabel);\n        grid.appendChild(dailyBudgetLabel);\n        grid.appendChild(proxyLabel);\n        grid.appendChild(apiKeyLabel);",
    ),
    (
        "        var payload = {\n            prompt: question,\n            question: question,\n            model: effectiveModel,",
        "        var payload = {\n            prompt: question,\n            question: question,\n            apiKey: state.apiKey,\n            model: effectiveModel,",
    ),
]

COURSE_SWITCHER_REPLACEMENTS = [
    (
        "    sdd: 'https://architecture-stack-sdd.vercel.app'\n  };",
        "    sdd: 'https://architecture-stack.vercel.app/sdd/index.html',\n    governance: 'https://architecture-stack.vercel.app/governance/index.html'\n  };",
    ),
    (
        "    android: 'https://architecture-stack-android.vercel.app',\n    sdd: 'https://architecture-stack-sdd.vercel.app',\n    governance: 'https://architecture-stack.vercel.app/governance/index.html'\n  };",
        "    android: 'https://architecture-stack.vercel.app/android/index.html',\n    sdd: 'https://architecture-stack.vercel.app/sdd/index.html',\n    governance: 'https://architecture-stack.vercel.app/governance/index.html'\n  };",
    ),
    (
        "    if (href.indexOf('/sdd/') !== -1) return href.split('/sdd/')[0];\n    return '';",
        "    if (href.indexOf('/sdd/') !== -1) return href.split('/sdd/')[0];\n    if (href.indexOf('/governance/') !== -1) return href.split('/governance/')[0];\n    return '';",
    ),
    (
        "    if (sdd) sdd.textContent = '\U0001f9e0 Curso IA + SDD';\n    setAuthLinks(syncParams);",
        "    if (sdd) sdd.textContent = '\U0001f9e0 Curso IA + SDD';\n    var governanceMenu = document.getElementById('course-switcher-menu');\n    var governance = governanceMenu ? ensureMenuLink(governanceMenu, 'course-switcher-governance') : null;\n    if (governance) {\n      governance.href = resolveCourseLink('/governance/index.html', REMOTE_LINKS.governance, syncParams);\n      governance.textContent = '\U0001f3db\ufe0f Governance';\n    }\n    setAuthLinks(syncParams);",
    ),
    (
        "    governance: 'https://architecture-stack.vercel.app/governance/index.html'\n  };",
        "    governance: 'https://architecture-stack.vercel.app/governance/index.html',\n    pumuki: 'https://architecture-stack.vercel.app/pumuki/index.html'\n  };",
    ),
    (
        "    if (href.indexOf('/governance/') !== -1) return href.split('/governance/')[0];\n    return '';",
        "    if (href.indexOf('/governance/') !== -1) return href.split('/governance/')[0];\n    if (href.indexOf('/pumuki/') !== -1) return href.split('/pumuki/')[0];\n    return '';",
    ),
    (
        "      governance.textContent = '\U0001f3db\ufe0f Governance';\n    }\n    setAuthLinks(syncParams);",
        "      governance.textContent = '\U0001f3db\ufe0f Governance';\n    }\n    var pumukiLink = governanceMenu ? ensureMenuLink(governanceMenu, 'course-switcher-pumuki') : null;\n    if (pumukiLink) {\n      pumukiLink.href = resolveCourseLink('/pumuki/index.html', REMOTE_LINKS.pumuki, syncParams);\n      pumukiLink.textContent = '\U0001f6e1\ufe0f Pumuki';\n    }\n    setAuthLinks(syncParams);",
    ),
    (
        """  function readStoredAuthSession() {
    var session = readJsonStorage(AUTH_SESSION_KEY);
    if (!session || !session.accessToken) return null;
    return session;
  }
""",
        """  function readStoredAuthSession() {
    var session = readJsonStorage(AUTH_SESSION_KEY);
    if (!session) return null;
    var accessToken = String(session.accessToken || session.access_token || session.token || '').trim();
    if (!accessToken) return null;
    session.accessToken = accessToken;
    return session;
  }
""",
    ),
    (
        """  function enforceAuthenticatedAccess(syncParams) {
    if (isLocalContext()) return true;
    if (hasAuthenticatedUser()) return true;
    var loginUrl = resolveLoginUrl(new URLSearchParams(), sanitizeNextPath(resolveCurrentPath()));
    window.location.replace(loginUrl);
    return false;
  }
""",
        """  function enforceAuthenticatedAccess(syncParams) {
    if (isLocalContext()) return true;
    hasAuthenticatedUser();
    return true;
  }
""",
    ),
]

THEME_CONTROLS_REPLACEMENTS = [
    (
        """  function buildMermaidPalette() {\n    var theme = activeTheme();\n    var style = activeStyle();\n    var accent = readVar('--accent', '#2563eb');\n    var accentLight = readVar('--accent-light', accent);\n    var accentDark = readVar('--accent-dark', accent);\n    var bg = readVar('--bg', '#ffffff');\n    var bgSurface = readVar('--bg-surface', bg);\n    var bgElevated = readVar('--bg-elevated', bgSurface);\n    var text = readVar('--text', '#0f172a');\n    var border = readVar('--border', '#cbd5e1');\n    var line = theme === 'dark' ? accentLight : accentDark;\n\n    var direct = theme === 'dark' ? '#f472b6' : '#d946ef';\n    var dashedClosed = theme === 'dark' ? '#cbd5e1' : '#64748b';\n    var dashedOpen = theme === 'dark' ? '#93c5fd' : '#2563eb';\n    var solidOpen = theme === 'dark' ? '#6ee7b7' : '#059669';\n\n    if (style === 'paper') {\n      direct = theme === 'dark' ? '#fda4af' : '#be185d';\n      dashedClosed = theme === 'dark' ? '#e5d7c5' : '#6b5b4a';\n      dashedOpen = theme === 'dark' ? '#bfdbfe' : '#1d4ed8';\n      solidOpen = theme === 'dark' ? '#86efac' : '#166534';\n    }\n\n    if (style === 'bold') {\n      direct = '#f472b6';\n      dashedClosed = '#d4d4d8';\n      dashedOpen = '#60a5fa';\n      solidOpen = '#34d399';\n    }\n\n    return {\n      bg: bgSurface,\n      text: text,\n      nodeBg: bgElevated,\n      nodeBorder: border,\n      line: line,\n      labelBg: bg,\n      direct: direct,\n      dashedClosed: dashedClosed,\n      dashedOpen: dashedOpen,\n      solidOpen: solidOpen\n    };\n  }\n""",
        """  function buildMermaidPalette() {\n    var theme = activeTheme();\n    var style = activeStyle();\n    var accent = readVar('--accent', '#2563eb');\n    var accentLight = readVar('--accent-light', accent);\n    var accentDark = readVar('--accent-dark', accent);\n    var bg = readVar('--bg', '#ffffff');\n    var bgSurface = readVar('--bg-surface', bg);\n    var bgElevated = readVar('--bg-elevated', bgSurface);\n    var text = readVar('--text', '#0f172a');\n    var border = readVar('--border', '#cbd5e1');\n    var line = theme === 'dark' ? accentLight : accentDark;\n\n    var direct = theme === 'dark' ? '#f472b6' : '#d946ef';\n    var dashedClosed = theme === 'dark' ? '#cbd5e1' : '#64748b';\n    var dashedOpen = theme === 'dark' ? '#93c5fd' : '#2563eb';\n    var solidOpen = theme === 'dark' ? '#6ee7b7' : '#059669';\n\n    if (style === 'paper') {\n      direct = theme === 'dark' ? '#fda4af' : '#be185d';\n      dashedClosed = theme === 'dark' ? '#e5d7c5' : '#6b5b4a';\n      dashedOpen = theme === 'dark' ? '#bfdbfe' : '#1d4ed8';\n      solidOpen = theme === 'dark' ? '#86efac' : '#166534';\n    }\n\n    if (style === 'bold') {\n      direct = '#f472b6';\n      dashedClosed = '#d4d4d8';\n      dashedOpen = '#60a5fa';\n      solidOpen = '#34d399';\n    }\n\n    if (theme === 'light') {\n      bgSurface = style === 'paper' ? '#f7f3ea' : '#f4f7fb';\n      bgElevated = style === 'paper' ? '#fffdf8' : '#edf4ff';\n      border = style === 'paper' ? '#8b7355' : '#5b6f95';\n      line = style === 'paper' ? '#7c3f00' : '#1d4ed8';\n    }\n\n    return {\n      bg: bgSurface,\n      text: text,\n      nodeBg: bgElevated,\n      nodeBorder: border,\n      line: line,\n      labelBg: bg,\n      direct: direct,\n      dashedClosed: dashedClosed,\n      dashedOpen: dashedOpen,\n      solidOpen: solidOpen\n    };\n  }\n""",
    ),
    (
        """  function applyMermaidSvgOverrides(root) {\n    var p = buildMermaidPalette();\n    var host = root && typeof root.querySelectorAll === 'function' ? root : document;\n    host.querySelectorAll('pre.mermaid svg').forEach(function (svg) {\n      uniquifySvgIds(svg);\n\n      svg.querySelectorAll('text, tspan').forEach(function (el) {\n        el.setAttribute('fill', p.text);\n        setImportantStyle(el, 'fill', p.text);\n        setImportantStyle(el, 'color', p.text);\n      });\n      svg.querySelectorAll('foreignObject div, foreignObject span').forEach(function (el) {\n        setImportantStyle(el, 'color', p.text);\n      });\n      svg.querySelectorAll('.edgePath .path, path.relation, line').forEach(function (el) {\n        setImportantStyle(el, 'stroke', p.line);\n      });\n      svg.querySelectorAll('.arrowheadPath, marker path, marker polygon, marker polyline').forEach(function (el) {\n        setImportantStyle(el, 'fill', p.line);\n        setImportantStyle(el, 'stroke', p.line);\n        setImportantStyle(el, 'opacity', '1');\n      });\n      svg.querySelectorAll('.edgeLabel rect, .labelBkg').forEach(function (el) {\n        setImportantStyle(el, 'fill', p.labelBg);\n        setImportantStyle(el, 'opacity', '1');\n      });\n\n      enforceSequenceArrows(svg, p);\n    });\n  }\n""",
        """  function applyMermaidSvgOverrides(root) {\n    var p = buildMermaidPalette();\n    var host = root && typeof root.querySelectorAll === 'function' ? root : document;\n    host.querySelectorAll('pre.mermaid svg').forEach(function (svg) {\n      uniquifySvgIds(svg);\n\n      svg.querySelectorAll('text, tspan').forEach(function (el) {\n        el.setAttribute('fill', p.text);\n        setImportantStyle(el, 'fill', p.text);\n        setImportantStyle(el, 'color', p.text);\n      });\n      svg.querySelectorAll('foreignObject div, foreignObject span').forEach(function (el) {\n        setImportantStyle(el, 'color', p.text);\n      });\n      svg.querySelectorAll('.node rect, .node polygon, .node circle, .node ellipse, .node path, .label-container, .cluster rect, .actor, .labelBox').forEach(function (el) {\n        var inlineStyle = String(el.getAttribute('style') || '').toLowerCase();\n        if (inlineStyle.indexOf('fill:') === -1) {\n          setImportantStyle(el, 'fill', p.nodeBg);\n        }\n        if (inlineStyle.indexOf('stroke:') === -1) {\n          setImportantStyle(el, 'stroke', p.nodeBorder);\n        }\n        setImportantStyle(el, 'stroke-width', '1.6px');\n      });\n      svg.querySelectorAll('.edgePath .path, path.relation, line, .flowchart-link').forEach(function (el) {\n        setImportantStyle(el, 'stroke', p.line);\n      });\n      svg.querySelectorAll('.arrowheadPath, marker path, marker polygon, marker polyline').forEach(function (el) {\n        setImportantStyle(el, 'fill', p.line);\n        setImportantStyle(el, 'stroke', p.line);\n        setImportantStyle(el, 'opacity', '1');\n      });\n      svg.querySelectorAll('.edgeLabel rect, .labelBkg').forEach(function (el) {\n        setImportantStyle(el, 'fill', p.labelBg);\n        setImportantStyle(el, 'opacity', '1');\n      });\n\n      enforceSequenceArrows(svg, p);\n    });\n  }\n""",
    ),
]


def patch_file(path: Path, replacements: list[tuple[str, str]]) -> bool:
    content = path.read_text(encoding="utf-8")
    patched = content
    changed = False
    for before, after in replacements:
        if after in patched:
            continue
        if before not in patched:
            print(f"[patch-study-ux-runtime] skipping (missing block): {path}")
            continue
        patched = patched.replace(before, after, 1)
        changed = True
    if changed:
        path.write_text(patched, encoding="utf-8")
    return changed


def remove_inline_auth_guard(path: Path) -> bool:
    content = path.read_text(encoding="utf-8")
    patched = content.replace(INLINE_AUTH_GUARD, "", 1)
    if patched == content:
      return False
    path.write_text(patched, encoding="utf-8")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply Hub-only runtime UX hotfixes after copying course outputs")
    parser.add_argument("--hub-root", default=str(Path(__file__).resolve().parent.parent))
    args = parser.parse_args()

    hub_root = Path(args.hub_root).resolve()
    patched = []
    for course in COURSES:
        js_path = hub_root / course / "assets" / "study-ux.js"
        css_path = hub_root / course / "assets" / "study-ux.css"
        theme_controls_path = hub_root / course / "assets" / "theme-controls.js"
        if js_path.exists() and patch_file(js_path, JS_REPLACEMENTS):
            patched.append(js_path)
        if css_path.exists() and patch_file(css_path, CSS_REPLACEMENTS):
            patched.append(css_path)
        if theme_controls_path.exists() and patch_file(theme_controls_path, THEME_CONTROLS_REPLACEMENTS):
            patched.append(theme_controls_path)
        course_switcher_path = hub_root / course / "assets" / "course-switcher.js"
        if course_switcher_path.exists() and patch_file(course_switcher_path, COURSE_SWITCHER_REPLACEMENTS):
            patched.append(course_switcher_path)
        assistant_panel_path = hub_root / course / "assets" / "assistant-panel.js"
        if assistant_panel_path.exists() and patch_file(assistant_panel_path, ASSISTANT_PANEL_REPLACEMENTS):
            patched.append(assistant_panel_path)

    for course, relative_path in COURSE_HTML_TARGETS:
        html_path = hub_root / course / relative_path
        if html_path.exists() and remove_inline_auth_guard(html_path):
            patched.append(html_path)

    print("[patch-study-ux-runtime] patched files:")
    for path in patched:
        print(f"  - {path}")
    if not patched:
        print("  - none (already patched)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
