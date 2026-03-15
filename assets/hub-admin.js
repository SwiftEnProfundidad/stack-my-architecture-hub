(function () {
  const COURSE_OPTIONS = ['ios', 'android', 'sdd', 'all'];
  const ROLE_OPTIONS = ['student', 'trial', 'admin'];

  const els = {
    authActions: document.getElementById('admin-auth-actions'),
    message: document.getElementById('admin-message'),
    shell: document.getElementById('admin-shell'),
    users: document.getElementById('admin-users'),
    teasers: document.getElementById('admin-teasers'),
    auditLog: document.getElementById('admin-audit-log'),
    searchForm: document.getElementById('admin-search-form'),
    searchInput: document.getElementById('admin-search-input'),
    searchReset: document.getElementById('admin-search-reset'),
    teaserForm: document.getElementById('admin-teaser-form'),
    teaserCourse: document.getElementById('admin-teaser-course'),
    teaserTopic: document.getElementById('admin-teaser-topic'),
    teaserKind: document.getElementById('admin-teaser-kind'),
    teaserOrder: document.getElementById('admin-teaser-order'),
    teaserPublic: document.getElementById('admin-teaser-public')
  };

  const state = {
    auth: null,
    role: 'anonymous',
    local: isLocalContext(),
    users: [],
    teasers: [],
    auditLog: []
  };

  wireEvents();
  void bootstrap();
  window.addEventListener('sma:auth-changed', function () {
    void bootstrap();
  });

  async function bootstrap() {
    state.auth = readAuthState();
    renderAuthActions();

    if (!state.auth.loggedIn) {
      redirectToLogin();
      return;
    }

    try {
      const entitlements = await requestJson('/api/entitlements?route=me');
      state.role = entitlements.role || 'student';
      renderAuthActions();
      if (state.role !== 'admin') {
        els.shell.classList.add('hub-hidden');
        setMessage('Tu cuenta no tiene rol admin. Este panel solo está disponible para administración de plataforma.', 'error');
        return;
      }

      els.shell.classList.remove('hub-hidden');
      await Promise.all([loadUsers(''), loadTeasers(''), loadAuditLog()]);
      setMessage(`Panel admin activo para ${entitlements.user.email || entitlements.user.id}.`, 'ok');
    } catch (error) {
      if (error && error.statusCode === 401) {
        redirectToLogin();
        return;
      }
      els.shell.classList.add('hub-hidden');
      setMessage(error && error.message ? error.message : 'No se pudo cargar el panel admin.', 'error');
    }
  }

  function wireEvents() {
    if (els.searchForm) {
      els.searchForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        await loadUsers((els.searchInput && els.searchInput.value) || '');
      });
    }

    if (els.searchReset) {
      els.searchReset.addEventListener('click', async function () {
        if (els.searchInput) els.searchInput.value = '';
        await loadUsers('');
      });
    }

    if (els.teaserForm) {
      els.teaserForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        try {
          await postJson('/api/admin?route=teaser-upsert', {
            courseId: els.teaserCourse.value,
            topicId: els.teaserTopic.value.trim(),
            kind: els.teaserKind.value,
            sortOrder: Number(els.teaserOrder.value || 0),
            isPublic: els.teaserPublic.value === 'true'
          });
          await loadTeasers(els.teaserCourse.value);
          setMessage('Teaser actualizado correctamente.', 'ok');
          els.teaserTopic.value = '';
        } catch (error) {
          setMessage(error && error.message ? error.message : 'No se pudo guardar el teaser.', 'error');
        }
      });
    }
  }

  async function loadUsers(query) {
    const suffix = query ? `&q=${encodeURIComponent(query)}` : '';
    const payload = await requestJson(`/api/admin?route=users${suffix}`);
    state.users = Array.isArray(payload.users) ? payload.users : [];
    renderUsers();
  }

  async function loadTeasers(courseId) {
    const suffix = courseId ? `&courseId=${encodeURIComponent(courseId)}` : '';
    const payload = await requestJson(`/api/admin?route=teasers${suffix}`);
    state.teasers = Array.isArray(payload.teasers) ? payload.teasers : [];
    renderTeasers();
  }

  async function loadAuditLog() {
    const payload = await requestJson('/api/admin?route=audit-log');
    state.auditLog = Array.isArray(payload.entries) ? payload.entries : [];
    renderAuditLog();
  }

  function renderAuthActions() {
    if (!els.authActions) return;
    els.authActions.innerHTML = '';
    els.authActions.appendChild(makeAction('Volver al hub', '../index.html', 'hub-btn hub-btn-muted'));
    if (state.role === 'admin') {
      els.authActions.appendChild(makeTag('Admin activo', 'hub-role-badge', { role: 'admin' }));
    }
    if (state.auth && state.auth.loggedIn) {
      els.authActions.appendChild(makeAction('Cerrar sesión', '#logout', 'hub-btn hub-btn-danger', async function (event) {
        event.preventDefault();
        await window.SMAAuth.logout();
        redirectToLogin();
      }));
    }
  }

  function renderUsers() {
    if (!els.users) return;
    if (!state.users.length) {
      els.users.innerHTML = '<div class="hub-empty">No se han encontrado usuarios para este filtro.</div>';
      return;
    }

    els.users.innerHTML = state.users.map(function (user) {
      const entitlements = Array.isArray(user.entitlements) ? user.entitlements : [];
      const progress = Array.isArray(user.progress) ? user.progress : [];
      return [
        `<article class="hub-admin-user" data-user-id="${escapeHtml(user.id)}">`,
        '<div class="hub-course-head">',
        `<div><h3 class="hub-course-title">${escapeHtml(user.email || user.id)}</h3><p class="hub-admin-meta">ID: ${escapeHtml(user.id)}</p></div>`,
        `<span class="hub-role-badge" data-role="${escapeHtml(user.role)}">${escapeHtml(roleLabel(user.role))}</span>`,
        '</div>',
        `<p class="hub-inline-note">Confirmado: <strong>${escapeHtml(user.emailConfirmedAt || 'pendiente')}</strong></p>`,
        '<div class="hub-form-grid two-cols">',
        `<label class="hub-label">Rol<select class="hub-select" data-role-select="${escapeHtml(user.id)}">${ROLE_OPTIONS.map(function (role) { return `<option value="${role}"${role === user.role ? ' selected' : ''}>${role}</option>`; }).join('')}</select></label>`,
        `<div class="hub-form-actions"><button class="hub-btn hub-btn-primary" data-role-save="${escapeHtml(user.id)}" type="button">Guardar rol</button></div>`,
        '</div>',
        '<div class="hub-mini-grid">',
        miniStat('Entitlements', String(entitlements.length)),
        miniStat('Cursos tocados', String(progress.length)),
        miniStat('Completadas', String(progress.reduce(function (acc, item) { return acc + Number(item.completedCount || 0); }, 0))),
        miniStat('Repaso', String(progress.reduce(function (acc, item) { return acc + Number(item.reviewCount || 0); }, 0))),
        '</div>',
        '<div class="hub-stack">',
        '<div>',
        '<p class="hub-list-title">Entitlements activos / históricos</p>',
        entitlements.length ? `<div class="hub-list">${entitlements.map(function (item) { return renderEntitlement(user.id, item); }).join('')}</div>` : '<div class="hub-empty">Sin entitlements todavía.</div>',
        '</div>',
        '<form class="hub-form-grid two-cols" data-grant-form="' + escapeHtml(user.id) + '">',
        '<label class="hub-label">Curso<select class="hub-select" name="courseId">' + COURSE_OPTIONS.map(function (courseId) { return `<option value="${courseId}">${courseId}</option>`; }).join('') + '</select></label>',
        '<label class="hub-label">Plan code<input class="hub-input" name="planCode" type="text" value="ios" /></label>',
        '<label class="hub-label">Estado<select class="hub-select" name="status"><option value="active">active</option><option value="trial">trial</option></select></label>',
        '<label class="hub-label">Expira en<input class="hub-input" name="expiresAt" type="datetime-local" /></label>',
        '<label class="hub-label" style="grid-column: 1 / -1;">Notas<textarea class="hub-textarea" name="notes" placeholder="Contexto interno u observaciones de acceso"></textarea></label>',
        '<div class="hub-form-actions" style="grid-column: 1 / -1;"><button class="hub-btn hub-btn-primary" type="submit">Conceder / actualizar entitlement</button></div>',
        '</form>',
        '</div>',
        '</article>'
      ].join('');
    }).join('');

    bindUserActions();
  }

  function renderEntitlement(userId, entitlement) {
    return [
      '<article class="hub-list-item">',
      `<p class="hub-list-title">${escapeHtml(entitlement.courseId)} · ${escapeHtml(entitlement.planCode || 'n/a')} · ${escapeHtml(entitlement.status)}</p>`,
      `<p class="hub-list-copy">Grant: ${escapeHtml(entitlement.grantedAt || 'n/a')} · Expira: ${escapeHtml(entitlement.expiresAt || 'sin fecha')} · ${escapeHtml(entitlement.notes || 'sin notas')}</p>`,
      `<div class="hub-list-actions"><button class="hub-btn hub-btn-danger" type="button" data-revoke-user="${escapeHtml(userId)}" data-revoke-course="${escapeHtml(entitlement.courseId)}">Revocar</button></div>`,
      '</article>'
    ].join('');
  }

  function renderTeasers() {
    if (!els.teasers) return;
    if (!state.teasers.length) {
      els.teasers.innerHTML = '<div class="hub-empty">Todavía no hay teasers configurados para este filtro.</div>';
      return;
    }

    els.teasers.innerHTML = state.teasers.map(function (teaser) {
      return [
        '<article class="hub-list-item">',
        `<p class="hub-list-title">${escapeHtml(teaser.courseId)} · ${escapeHtml(teaser.topicId)}</p>`,
        `<p class="hub-list-copy">Tipo: ${escapeHtml(teaser.kind)} · Público: ${escapeHtml(String(teaser.isPublic))} · Orden: ${escapeHtml(String(teaser.sortOrder))}</p>`,
        '</article>'
      ].join('');
    }).join('');
  }

  function renderAuditLog() {
    if (!els.auditLog) return;
    const entries = Array.isArray(state.auditLog) ? state.auditLog : [];
    if (!entries.length) {
      els.auditLog.innerHTML = '<div class="hub-empty">Todavía no hay eventos de auditoría registrados.</div>';
      return;
    }

    els.auditLog.innerHTML = entries.map(function (entry) {
      const payload = entry.payload && typeof entry.payload === 'object' ? Object.entries(entry.payload).map(function (item) {
        return `${item[0]}=${String(item[1])}`;
      }).join(' · ') : 'sin payload';
      return [
        '<article class="hub-list-item">',
        `<p class="hub-list-title">${escapeHtml(entry.action || 'unknown')}</p>`,
        `<p class="hub-list-copy">Actor: ${escapeHtml(entry.actorUserId || 'n/a')} · Subject: ${escapeHtml(entry.subjectUserId || 'n/a')}</p>`,
        `<p class="hub-admin-meta">${escapeHtml(entry.createdAt || 'sin fecha')} · ${escapeHtml(payload)}</p>`,
        '</article>'
      ].join('');
    }).join('');
  }

  function bindUserActions() {
    Array.from(document.querySelectorAll('[data-role-save]')).forEach(function (button) {
      button.addEventListener('click', async function () {
        const userId = button.getAttribute('data-role-save');
        const select = document.querySelector(`[data-role-select="${cssEscape(userId)}"]`);
        if (!select) return;
        try {
          await postJson('/api/admin?route=set-role', {
            userId: userId,
            role: select.value
          });
          await loadUsers((els.searchInput && els.searchInput.value) || '');
          setMessage('Rol actualizado correctamente.', 'ok');
        } catch (error) {
          setMessage(error && error.message ? error.message : 'No se pudo actualizar el rol.', 'error');
        }
      });
    });

    Array.from(document.querySelectorAll('[data-grant-form]')).forEach(function (form) {
      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        const userId = form.getAttribute('data-grant-form');
        const formData = new FormData(form);
        try {
          await postJson('/api/admin?route=grant-entitlement', {
            userId: userId,
            courseId: formData.get('courseId'),
            planCode: formData.get('planCode'),
            status: formData.get('status'),
            expiresAt: normalizeDateTime(formData.get('expiresAt')),
            notes: formData.get('notes')
          });
          await loadUsers((els.searchInput && els.searchInput.value) || '');
          setMessage('Entitlement actualizado correctamente.', 'ok');
        } catch (error) {
          setMessage(error && error.message ? error.message : 'No se pudo actualizar el entitlement.', 'error');
        }
      });
    });

    Array.from(document.querySelectorAll('[data-revoke-user]')).forEach(function (button) {
      button.addEventListener('click', async function () {
        try {
          await postJson('/api/admin?route=revoke-entitlement', {
            userId: button.getAttribute('data-revoke-user'),
            courseId: button.getAttribute('data-revoke-course'),
            notes: 'Revocado desde panel admin web'
          });
          await loadUsers((els.searchInput && els.searchInput.value) || '');
          setMessage('Entitlement revocado correctamente.', 'ok');
        } catch (error) {
          setMessage(error && error.message ? error.message : 'No se pudo revocar el entitlement.', 'error');
        }
      });
    });
  }

  async function requestJson(url) {
    const headers = {};
    const accessToken = resolveAccessToken(state.auth && state.auth.session ? state.auth.session : null);
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    const response = await fetch(toApiUrl(url), { method: 'GET', headers: headers });
    const payload = await response.json().catch(function () { return null; });
    if (!response.ok || !payload || payload.ok === false) {
      const error = new Error(payload && payload.error ? payload.error : `Error ${response.status}`);
      error.statusCode = response.status;
      throw error;
    }
    return payload;
  }

  async function postJson(url, body) {
    const headers = { 'Content-Type': 'application/json' };
    const accessToken = resolveAccessToken(state.auth && state.auth.session ? state.auth.session : null);
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    const response = await fetch(toApiUrl(url), {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body || {})
    });
    const payload = await response.json().catch(function () { return null; });
    if (!response.ok || !payload || payload.ok === false) {
      const error = new Error(payload && payload.error ? payload.error : `Error ${response.status}`);
      error.statusCode = response.status;
      throw error;
    }
    return payload;
  }

  function readAuthState() {
    const session = window.SMAAuth && typeof window.SMAAuth.getSession === 'function' ? window.SMAAuth.getSession() : null;
    const user = window.SMAAuth && typeof window.SMAAuth.getUser === 'function' ? window.SMAAuth.getUser() : null;
    const accessToken = resolveAccessToken(session);
    return {
      loggedIn: Boolean(accessToken && user && user.id),
      session: session,
      user: user
    };
  }

  function isLocalContext() {
    const host = String(window.location.hostname || '').toLowerCase();
    if (window.location.protocol === 'file:') return true;
    if (!host) return false;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') return true;
    if (host.endsWith('.local') || host.endsWith('.nip.io')) return true;
    if (/^10\./.test(host) || /^192\.168\./.test(host)) return true;
    const private172 = host.match(/^172\.(\d{1,3})\./);
    if (!private172) return false;
    const secondOctet = Number(private172[1]);
    return Number.isFinite(secondOctet) && secondOctet >= 16 && secondOctet <= 31;
  }

  function toApiUrl(path) {
    const rawPath = String(path || '').trim();
    if (!rawPath) return '/api';
    let routePath = rawPath;
    if (routePath.startsWith('/api/')) routePath = routePath.slice(5);
    if (routePath.startsWith('api/')) routePath = routePath.slice(4);
    if (routePath.startsWith('/')) routePath = routePath.slice(1);
    if (state.local) {
      return `/${routePath}`;
    }
    const q = routePath.indexOf('?');
    const basePath = q >= 0 ? routePath.slice(0, q) : routePath;
    const query = q >= 0 ? routePath.slice(q + 1) : '';
    const normalized = String(basePath || '').replace(/^\/+/, '');
    return `/api/proxy?path=${encodeURIComponent(normalized)}${query ? `&${query}` : ''}`;
  }

  function resolveAccessToken(session) {
    const token = String(session && (session.accessToken || session.access_token || session.token) || '').trim();
    if (!token || token.length > 4096) return '';
    return token;
  }

  function redirectToLogin() {
    const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const target = new URL('../auth/login.html', window.location.href);
    target.searchParams.set('next', next);
    window.location.replace(target.pathname + target.search + target.hash);
  }

  function setMessage(text, tone) {
    if (!els.message) return;
    els.message.textContent = text || '';
    els.message.dataset.tone = tone || 'ok';
    els.message.classList.toggle('is-visible', Boolean(text));
  }

  function makeAction(label, href, className, onClick) {
    const link = document.createElement('a');
    link.className = className;
    link.href = href;
    link.textContent = label;
    if (typeof onClick === 'function') link.addEventListener('click', onClick);
    return link;
  }

  function makeTag(label, className, dataset) {
    const node = document.createElement('span');
    node.className = className;
    node.textContent = label;
    Object.keys(dataset || {}).forEach(function (key) {
      node.dataset[key] = dataset[key];
    });
    return node;
  }

  function miniStat(label, value) {
    return `<div class="hub-mini-stat"><p class="hub-mini-label">${escapeHtml(label)}</p><p class="hub-mini-value">${escapeHtml(value)}</p></div>`;
  }

  function roleLabel(role) {
    if (role === 'admin') return 'admin';
    if (role === 'trial') return 'trial';
    return 'student';
  }

  function normalizeDateTime(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
  }

  function cssEscape(value) {
    return String(value || '').replace(/(["\\])/g, '\\$1');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
