(function () {
  const COURSE_META = {
    ios: {
      label: 'Curso iOS',
      title: 'Arquitectura iOS enterprise',
      path: './ios/index.html',
      summary: 'Swift, SwiftUI, Clean Architecture, DDD, testing, observabilidad y gobierno técnico sobre una app real.'
    },
    android: {
      label: 'Curso Android',
      title: 'Arquitectura Android enterprise',
      path: './android/index.html',
      summary: 'Kotlin, Compose, Hilt, Room, offline-first, quality gates y evolución real de un producto Android.'
    },
    sdd: {
      label: 'Curso IA + SDD',
      title: 'IA + Spec-Driven Development',
      path: './sdd/index.html',
      summary: 'OpenSpec, calidad verificable, gobierno de cambios, señales operativas y defensa técnica con evidencia.'
    }
  };

  const INTERVIEW_PACKS = {
    ios: {
      title: 'Defensa técnica iOS',
      summary: 'Ensaya cómo explicar arquitectura por capas, decisiones de concurrencia y cierre defendible sin caer en respuestas genéricas.',
      eyebrow: 'Swift · SwiftUI · Clean Architecture',
      leadQuestion: '¿Cómo justificas Feature-First + Composition Root + puertos sin convertir la app en ceremonias vacías?',
      sourceTopicIds: [
        '05-maestria-11-entrevista-arquitecto',
        '05-maestria-10-rubrica-final-03-checklist-entrega-para-entrevista',
        '06-proyecto-final-00-proyecto-final-ios'
      ]
    },
    android: {
      title: 'Defensa técnica Android',
      summary: 'Entrena cómo defender offline-first, gobernanza de módulos y evolución multi-equipo con señales reales de producto.',
      eyebrow: 'Kotlin · Compose · Offline-first',
      leadQuestion: '¿Qué trade-off aceptaste en sincronización offline-first y cómo demostrarías que fue la decisión correcta?',
      sourceTopicIds: [
        '04-maestria-07-defensa-tecnica-del-proyecto-android',
        '04-maestria-09-rubrica-final-y-entrevista-tecnica-android',
        '05-proyecto-final-01-rubrica-empleabilidad'
      ]
    },
    sdd: {
      title: 'Defensa técnica IA + SDD',
      summary: 'Practica cómo defender OpenSpec, quality gates y cierre enterprise con evidencia trazable y ejecutable.',
      eyebrow: 'OpenSpec · Gobernanza · Release readiness',
      leadQuestion: '¿Cómo explicarías que SDD no es “más documentación”, sino una forma de reducir riesgo y elevar calidad verificable?',
      sourceTopicIds: [
        '17-semana-16-00-semana-16-roadmap',
        '18-proyecto-final-02-rubrica-y-defensa-final',
        '00-informe-SCORECARD-EMPLEABILIDAD'
      ]
    }
  };

  const els = {
    authBar: document.getElementById('hub-auth-bar'),
    statusBox: document.getElementById('hub-status-box'),
    accountCta: document.getElementById('hub-account-cta'),
    dashboardSection: document.getElementById('hub-dashboard-section'),
    dashboardKpis: document.getElementById('hub-dashboard-kpis'),
    dashboardCourses: document.getElementById('hub-dashboard-courses'),
    dashboardNext: document.getElementById('hub-dashboard-next'),
    dashboardInterview: document.getElementById('hub-dashboard-interview'),
    dashboardNotes: document.getElementById('hub-dashboard-notes'),
    dashboardBookmarks: document.getElementById('hub-dashboard-bookmarks'),
    dashboardReview: document.getElementById('hub-dashboard-review'),
    dashboardAccount: document.getElementById('hub-dashboard-account'),
    coursesGrid: document.getElementById('hub-courses-grid'),
    accessSummary: document.getElementById('hub-access-summary')
  };

  const state = {
    local: isLocalContext(),
    auth: null,
    entitlements: null,
    dashboard: null,
    access: {}
  };

  void bootstrap();
  window.addEventListener('sma:auth-changed', function () {
    void bootstrap();
  });

  async function bootstrap() {
    setStatus('Cargando estado de plataforma...', 'warn');
    state.auth = readAuthState();
    state.entitlements = null;
    state.dashboard = null;
    state.access = {};

    if (state.auth.loggedIn) {
      const authPayload = await loadAuthenticatedData();
      if (!authPayload) return;
    }

    await loadCourseAccess();
    render();
  }

  function render() {
    renderAuthBar();
    renderDashboard();
    renderAccessSummary();
    renderCourses();
    resolveStatusMessage();
  }

  function resolveStatusMessage() {
    if (state.auth.loggedIn && state.dashboard && state.dashboard.user) {
      const label = state.dashboard.user.email || state.dashboard.user.id;
      setStatus(`Sesión activa como ${label}.`, 'ok');
      return;
    }

    if (state.local) {
      setStatus('Modo local activo: el acceso completo queda habilitado solo para desarrollo y validación rápida.', 'ok');
      return;
    }

    setStatus('Modo teaser activo: inicia sesión para desbloquear cursos completos, progreso cloud, notas y bookmarks.', 'warn');
  }

  async function loadAuthenticatedData() {
    try {
      const [entitlements, dashboard] = await Promise.all([
        requestJson('/api/entitlements?route=me', { auth: true }),
        requestJson('/api/dashboard', { auth: true })
      ]);
      state.entitlements = entitlements;
      state.dashboard = dashboard;
      return true;
    } catch (error) {
      if (error && (error.statusCode === 401 || error.statusCode === 403) && window.SMAAuth && typeof window.SMAAuth.clearAuth === 'function') {
        window.SMAAuth.clearAuth();
      }
      state.auth = readAuthState();
      setStatus(error && error.message ? error.message : 'No se pudo cargar tu cuenta.', 'error');
      return false;
    }
  }

  async function loadCourseAccess() {
    const entries = await Promise.all(Object.keys(COURSE_META).map(async function (courseId) {
      if (state.local && !state.auth.loggedIn) {
        return [courseId, {
          courseId: courseId,
          access: 'full',
          allowed: true,
          fullAccess: true,
          teaserTopicIds: []
        }];
      }

      if (state.dashboard) {
        const course = (state.dashboard.courses || []).find(function (item) { return item.courseId === courseId; });
        if (course) {
          return [courseId, {
            courseId: courseId,
            access: course.access,
            allowed: course.allowed,
            fullAccess: course.access === 'full',
            teaserTopicIds: []
          }];
        }
      }

      try {
        const payload = await requestJson(`/api/entitlements?route=access&courseId=${encodeURIComponent(courseId)}`, {
          auth: state.auth.loggedIn
        });
        return [courseId, payload.access];
      } catch (_error) {
        return [courseId, {
          courseId: courseId,
          access: state.local ? 'full' : 'blocked',
          allowed: state.local,
          fullAccess: state.local,
          teaserTopicIds: []
        }];
      }
    }));

    state.access = Object.fromEntries(entries);
  }

  function renderAuthBar() {
    if (!els.authBar) return;
    els.authBar.innerHTML = '';

    const fragment = document.createDocumentFragment();
    const role = state.dashboard && state.dashboard.role ? state.dashboard.role : (state.auth.loggedIn ? 'student' : 'anonymous');

    fragment.appendChild(createTag(state.local ? 'Modo local: bypass activo' : roleLabel(role), role === 'admin' ? 'full' : (state.local ? 'teaser' : 'blocked'), 'hub-role-badge', role));

    if (state.auth.loggedIn) {
      fragment.appendChild(createButton('Mi cuenta', './auth/index.html', 'hub-btn hub-btn-primary'));
      fragment.appendChild(createButton('Cerrar sesión', '#logout', 'hub-btn hub-btn-muted', async function (event) {
        event.preventDefault();
        if (!window.SMAAuth || typeof window.SMAAuth.logout !== 'function') return;
        await window.SMAAuth.logout();
        await bootstrap();
      }));
      if ((state.dashboard && state.dashboard.role === 'admin') || (state.entitlements && state.entitlements.role === 'admin')) {
        fragment.appendChild(createButton('Panel admin', './admin/index.html', 'hub-btn hub-btn-primary'));
      }
    } else {
      fragment.appendChild(createButton('Crear cuenta', './auth/register.html', 'hub-btn hub-btn-primary'));
      fragment.appendChild(createButton('Iniciar sesión', './auth/login.html', 'hub-btn hub-btn-muted'));
      fragment.appendChild(createButton('Cuenta y sincronización', './auth/index.html', 'hub-btn hub-btn-muted'));
    }

    els.authBar.appendChild(fragment);
  }

  function renderDashboard() {
    if (!els.dashboardSection) return;
    const shouldShow = state.auth.loggedIn && state.dashboard;
    els.dashboardSection.classList.toggle('hub-hidden', !shouldShow);
    if (!shouldShow) return;

    renderDashboardKpis();
    renderDashboardNext();
    renderDashboardCourses();
    renderDashboardInterview();
    renderDashboardAccount();
    renderDashboardList(els.dashboardNotes, state.dashboard.notes || [], 'Aún no tienes notas privadas guardadas.', function (item) {
      return {
        title: `${courseLabel(item.courseId)} · ${item.topicId}`,
        copy: item.preview || 'Nota sin preview disponible.',
        href: courseUrl(item.courseId, item.topicId)
      };
    });
    renderDashboardList(els.dashboardBookmarks, state.dashboard.bookmarks || [], 'Aún no tienes bookmarks guardados.', function (item) {
      return {
        title: `${courseLabel(item.courseId)} · ${item.topicId}`,
        copy: 'Acceso rápido a la lección guardada para volver sin perder contexto.',
        href: courseUrl(item.courseId, item.topicId)
      };
    });
    renderDashboardList(els.dashboardReview, state.dashboard.reviewQueue || [], 'No tienes lecciones marcadas para repaso en este momento.', function (item) {
      return {
        title: `${courseLabel(item.courseId)} · ${item.topicId}`,
        copy: 'Repaso prioritario pendiente. Úsalo para retomar conceptos que ya marcaste como críticos.',
        href: courseUrl(item.courseId, item.topicId)
      };
    });
  }

  function renderDashboardKpis() {
    if (!els.dashboardKpis) return;
    const courses = state.dashboard.courses || [];
    const totals = courses.reduce(function (acc, course) {
      acc.completed += Number(course.completedCount || 0);
      acc.review += Number(course.reviewCount || 0);
      acc.notes += Number(course.noteCount || 0);
      acc.bookmarks += Number(course.bookmarkCount || 0);
      return acc;
    }, { completed: 0, review: 0, notes: 0, bookmarks: 0 });

    const items = [
      { label: 'Lecciones completadas', value: String(totals.completed) },
      { label: 'Marcadas para repaso', value: String(totals.review) },
      { label: 'Notas privadas', value: String(totals.notes) },
      { label: 'Bookmarks', value: String(totals.bookmarks) }
    ];

    els.dashboardKpis.innerHTML = items.map(function (item) {
      return `<article class="hub-kpi"><p class="hub-kpi-label">${escapeHtml(item.label)}</p><p class="hub-kpi-value">${escapeHtml(item.value)}</p></article>`;
    }).join('');
  }

  function renderDashboardNext() {
    if (!els.dashboardNext) return;
    const next = state.dashboard.nextStep || null;
    const body = [];
    body.push('<div class="hub-section-head">');
    body.push('<div>');
    body.push('<h2 class="hub-section-title">Continuidad recomendada</h2>');
    body.push('<p class="hub-section-copy">El hub prioriza el siguiente paso con más retorno pedagógico según tu progreso real.</p>');
    body.push('</div>');
    body.push('</div>');

    if (!next || !next.courseId) {
      body.push('<div class="hub-empty">Todavía no hay un siguiente paso calculado. Inicia un curso o desbloquéalo desde tu cuenta.</div>');
      els.dashboardNext.innerHTML = body.join('');
      return;
    }

    body.push('<div class="hub-list-item">');
    body.push(`<p class="hub-list-title">${escapeHtml(courseLabel(next.courseId))}</p>`);
    body.push(`<p class="hub-list-copy">${escapeHtml(next.label || 'Continúa desde tu siguiente lección recomendada.')}</p>`);
    const nextCourse = (state.dashboard.courses || []).find(function (item) { return item.courseId === next.courseId; });
    if (nextCourse && nextCourse.currentStageLabel) {
      body.push(`<p class="hub-course-meta">Etapa actual: <strong>${escapeHtml(nextCourse.currentStageLabel)}</strong>${nextCourse.nextStageLabel ? ` · Siguiente checkpoint: <strong>${escapeHtml(nextCourse.nextStageLabel)}</strong>` : ''}</p>`);
    }
    body.push('<div class="hub-list-actions">');
    body.push(`<a class="hub-btn hub-btn-primary" href="${escapeHtml(courseUrl(next.courseId, next.topicId))}">Continuar ahora</a>`);
    body.push(`<a class="hub-btn hub-btn-muted" href="${escapeHtml(COURSE_META[next.courseId].path)}">Abrir índice del curso</a>`);
    if (nextCourse && nextCourse.reviewTargetTopicId && nextCourse.reviewTargetTopicId !== next.topicId) {
      body.push(`<a class="hub-btn hub-btn-muted" href="${escapeHtml(courseUrl(next.courseId, nextCourse.reviewTargetTopicId))}">Ir al repaso prioritario</a>`);
    }
    body.push('</div></div>');
    els.dashboardNext.innerHTML = body.join('');
  }

  function renderDashboardCourses() {
    if (!els.dashboardCourses) return;
    const courses = state.dashboard.courses || [];
    els.dashboardCourses.innerHTML = courses.map(function (course) {
      return [
        '<article class="hub-course-card">',
        '<div class="hub-course-head">',
        `<div><p class="hub-eyebrow">${escapeHtml(courseLabel(course.courseId))}</p><h3 class="hub-course-title">${escapeHtml(COURSE_META[course.courseId].title)}</h3></div>`,
        badgeHtml(accessLabel(course.access), course.access, 'hub-access-badge'),
        '</div>',
        `<p class="hub-course-copy">${escapeHtml(COURSE_META[course.courseId].summary)}</p>`,
        '<div class="hub-mini-grid">',
        miniStat('Completadas', String(course.completedCount || 0)),
        miniStat('Repaso', String(course.reviewCount || 0)),
        miniStat('Notas', String(course.noteCount || 0)),
        miniStat('Bookmarks', String(course.bookmarkCount || 0)),
        '</div>',
        renderCourseProgress(course),
        `<p class="hub-course-meta">Etapa actual: <strong>${escapeHtml(course.currentStageLabel || 'Ruta principal')}</strong> · Checkpoints: <strong>${escapeHtml(String(course.completedCheckpoints || 0))}/${escapeHtml(String(course.totalCheckpoints || 0))}</strong></p>`,
        `<p class="hub-course-meta">Último tema: <strong>${escapeHtml(course.lastTopic || 'Aún sin abrir')}</strong></p>`,
        renderCourseQuickLinks(course),
        '<div class="hub-card-actions">',
        `<a class="hub-btn hub-btn-primary" href="${escapeHtml(resolvePrimaryCourseHref(course.courseId, course.access, course.nextStep && course.nextStep.topicId))}">${escapeHtml(resolvePrimaryCourseLabel(course.access))}</a>`,
        `<a class="hub-btn hub-btn-muted" href="${escapeHtml(resolveSecondaryCourseHref(course.courseId, course.access))}">${escapeHtml(resolveSecondaryCourseLabel(course.access))}</a>`,
        '</div>',
        '</article>'
      ].join('');
    }).join('');
  }

  function renderDashboardAccount() {
    if (!els.dashboardAccount) return;
    const entitlements = Array.isArray(state.dashboard.entitlements) ? state.dashboard.entitlements : [];
    const body = [];
    body.push('<div class="hub-section-head">');
    body.push('<div>');
    body.push('<h3 class="hub-section-title">Cuenta y plan</h3>');
    body.push('<p class="hub-section-copy">Resumen operativo de tu rol, cursos habilitados y accesos de cuenta.</p>');
    body.push('</div>');
    body.push('</div>');
    body.push('<div class="hub-mini-grid">');
    body.push(miniStat('Rol', roleLabel(state.dashboard.role || 'student')));
    body.push(miniStat('Cursos activos', String((state.dashboard.allowedCourses || []).length)));
    body.push(miniStat('Entitlements', String(entitlements.length)));
    body.push(miniStat('Repasos abiertos', String((state.dashboard.reviewQueue || []).length)));
    body.push('</div>');
    if (entitlements.length) {
      body.push('<div class="hub-chip-row">');
      entitlements.forEach(function (item) {
        body.push(`<span class="hub-chip">${escapeHtml(String(item.planCode || item.courseId || 'plan'))}</span>`);
      });
      body.push('</div>');
    }
    body.push('<div class="hub-list-actions">');
    body.push('<a class="hub-btn hub-btn-primary" href="./auth/index.html">Gestionar cuenta</a>');
    if (state.dashboard.reviewQueue && state.dashboard.reviewQueue.length) {
      const firstReview = state.dashboard.reviewQueue[0];
      body.push(`<a class="hub-btn hub-btn-muted" href="${escapeHtml(courseUrl(firstReview.courseId, firstReview.topicId))}">Ir a repaso prioritario</a>`);
    }
    body.push('</div>');
    els.dashboardAccount.innerHTML = body.join('');
  }

  function renderDashboardInterview() {
    if (!els.dashboardInterview) return;
    const enabledCourses = Object.keys(COURSE_META).filter(function (courseId) {
      if (state.local) return true;
      const access = state.access[courseId];
      return Boolean(state.auth.loggedIn && access && access.access === 'full');
    });

    if (!enabledCourses.length) {
      els.dashboardInterview.innerHTML = '<div class="hub-empty">El modo entrevista aparece cuando tu cuenta tiene acceso completo a algún curso. Mientras tanto, puedes revisar el catálogo o activar tu plan.</div>';
      return;
    }

    els.dashboardInterview.innerHTML = enabledCourses.map(function (courseId) {
      const pack = INTERVIEW_PACKS[courseId];
      const sourceTopicId = pack && Array.isArray(pack.sourceTopicIds) ? pack.sourceTopicIds[0] : '';
      return [
        '<article class="hub-course-card">',
        '<div class="hub-course-head">',
        `<div><p class="hub-eyebrow">${escapeHtml(pack.eyebrow || courseLabel(courseId))}</p><h3 class="hub-course-title">${escapeHtml(pack.title || courseLabel(courseId))}</h3></div>`,
        badgeHtml('Entrevista lista', 'full', 'hub-access-badge'),
        '</div>',
        `<p class="hub-course-copy">${escapeHtml(pack.summary || '')}</p>`,
        `<p class="hub-course-meta"><strong>Pregunta guía:</strong> ${escapeHtml(pack.leadQuestion || '')}</p>`,
        '<div class="hub-card-actions">',
        `<a class="hub-btn hub-btn-primary" href="${escapeHtml(courseInterviewUrl(courseId, sourceTopicId))}">Abrir modo entrevista</a>`,
        `<a class="hub-btn hub-btn-muted" href="${escapeHtml(courseUrl(courseId, sourceTopicId))}">Abrir lección fuente</a>`,
        '</div>',
        '</article>'
      ].join('');
    }).join('');
  }

  function renderDashboardList(node, items, emptyLabel, mapItem) {
    if (!node) return;
    const body = [];
    const normalized = Array.isArray(items) ? items : [];
    if (!normalized.length) {
      node.innerHTML = `<div class="hub-empty">${escapeHtml(emptyLabel)}</div>`;
      return;
    }

    normalized.forEach(function (item) {
      const mapped = mapItem(item);
      body.push('<article class="hub-list-item">');
      body.push(`<p class="hub-list-title">${escapeHtml(mapped.title)}</p>`);
      body.push(`<p class="hub-list-copy">${escapeHtml(mapped.copy)}</p>`);
      body.push(`<div class="hub-list-actions"><a class="hub-btn hub-btn-muted" href="${escapeHtml(mapped.href)}">Abrir lección</a></div>`);
      body.push('</article>');
    });

    node.innerHTML = body.join('');
  }

  function renderAccessSummary() {
    if (!els.accessSummary) return;
    const mode = state.local ? 'local' : (state.auth.loggedIn ? 'authenticated' : 'anonymous');
    if (mode === 'local') {
      els.accessSummary.innerHTML = '<div class="hub-access-banner"><p class="hub-list-title">Entorno local</p><p class="hub-list-copy">En local mantenemos bypass de acceso para desarrollo, validación pedagógica y revisión rápida del contenido.</p></div>';
      return;
    }
    if (mode === 'authenticated') {
      els.accessSummary.innerHTML = '<div class="hub-access-banner"><p class="hub-list-title">Acceso por cuenta</p><p class="hub-list-copy">Tus cursos, progreso, repaso, notas y bookmarks quedan ligados a tu cuenta autenticada y se sincronizan entre dispositivos.</p></div>';
      return;
    }
    els.accessSummary.innerHTML = '<div class="hub-access-banner"><p class="hub-list-title">Modo teaser</p><p class="hub-list-copy">Puedes explorar las lecciones de muestra públicas. Para abrir contenido premium completo, inicia sesión con un entitlement activo.</p></div>';
  }

  function renderCourses() {
    if (!els.coursesGrid) return;
    els.coursesGrid.innerHTML = Object.keys(COURSE_META).map(function (courseId) {
      const meta = COURSE_META[courseId];
      const access = state.access[courseId] || { access: state.local ? 'full' : 'blocked', allowed: state.local, fullAccess: state.local };
      const course = state.dashboard && Array.isArray(state.dashboard.courses)
        ? state.dashboard.courses.find(function (item) { return item.courseId === courseId; })
        : null;
      return [
        '<article class="hub-course-card">',
        '<div class="hub-course-head">',
        `<div><p class="hub-eyebrow">${escapeHtml(meta.label)}</p><h3 class="hub-course-title">${escapeHtml(meta.title)}</h3></div>`,
        badgeHtml(accessLabel(access.access), access.access, 'hub-access-badge'),
        '</div>',
        `<p class="hub-course-copy">${escapeHtml(meta.summary)}</p>`,
        '<div class="hub-mini-grid">',
        miniStat('Acceso', escapeHtml(accessLabel(access.access))),
        miniStat('Teasers', String((access.teaserTopicIds || []).length || (course ? course.teaserCount || 0 : 0))),
        miniStat('Completadas', String(course ? course.completedCount || 0 : 0)),
        miniStat('Repaso', String(course ? course.reviewCount || 0 : 0)),
        '</div>',
        course ? renderCourseProgress(course) : '',
        course ? `<p class="hub-course-meta">Etapa actual: <strong>${escapeHtml(course.currentStageLabel || 'Ruta principal')}</strong> · Checkpoints: <strong>${escapeHtml(String(course.completedCheckpoints || 0))}/${escapeHtml(String(course.totalCheckpoints || 0))}</strong></p>` : '',
        `<p class="hub-course-meta">${escapeHtml(resolveCourseMeta(access.access, course))}</p>`,
        renderCourseQuickLinks(course, access, courseId),
        '<div class="hub-card-actions">',
        `<a class="hub-btn hub-btn-primary" href="${escapeHtml(resolvePrimaryCourseHref(courseId, access.access, course && course.nextStep && course.nextStep.topicId))}">${escapeHtml(resolvePrimaryCourseLabel(access.access))}</a>`,
        `<a class="hub-btn hub-btn-muted" href="${escapeHtml(resolveSecondaryCourseHref(courseId, access.access))}">${escapeHtml(resolveSecondaryCourseLabel(access.access))}</a>`,
        '</div>',
        '</article>'
      ].join('');
    }).join('');
  }

  function resolvePrimaryCourseHref(courseId, access, topicId) {
    if (state.local) return courseUrl(courseId, topicId);
    if (access === 'full' || access === 'teaser') return courseUrl(courseId, topicId);
    return loginUrl(COURSE_META[courseId].path);
  }

  function resolveSecondaryCourseHref(courseId, access) {
    if (state.local) return './auth/index.html';
    if (!state.auth.loggedIn) return './auth/index.html';
    if (access === 'blocked') return './auth/index.html';
    return courseUrl(courseId, '');
  }

  function resolvePrimaryCourseLabel(access) {
    if (access === 'full') return 'Abrir curso';
    if (access === 'teaser') return 'Explorar muestra';
    return 'Iniciar sesión';
  }

  function resolveSecondaryCourseLabel(access) {
    if (!state.auth.loggedIn) return 'Cuenta y acceso';
    if (access === 'blocked') return 'Gestionar acceso';
    return 'Ir al índice';
  }

  function resolveCourseMeta(access, course) {
    if (state.local) return 'Bypass local activo para desarrollo. En host público el acceso se resuelve por entitlement + teaser.';
    if (access === 'full') {
      if (course && course.lastTopic) return `Último tema abierto: ${course.lastTopic}`;
      return 'Acceso completo activo para tu cuenta.';
    }
    if (access === 'teaser') return 'Acceso limitado a lecciones teaser públicas.';
    return 'Contenido premium bloqueado hasta disponer de entitlement activo.';
  }

  function renderCourseProgress(course) {
    const percent = Math.max(0, Math.min(100, Number(course.stageProgressPercent || 0)));
    const ordinal = Number(course.currentStageOrdinal || 0);
    const total = Number(course.totalCheckpoints || 0);
    const summary = ordinal && total
      ? `Ruta actual: ${ordinal}/${total}`
      : 'Ruta actual: pendiente de inicio';
    return [
      '<div class="hub-progress">',
      `<div class="hub-progress-head"><p class="hub-mini-label">Progreso de ruta</p><p class="hub-progress-copy">${escapeHtml(summary)}</p></div>`,
      '<div class="hub-progress-track" aria-hidden="true">',
      `<span class="hub-progress-fill" style="width:${escapeHtml(String(percent))}%"></span>`,
      '</div>',
      '</div>'
    ].join('');
  }

  function renderCourseQuickLinks(course, access, fallbackCourseId) {
    const courseId = course && course.courseId ? course.courseId : fallbackCourseId;
    const actions = [];
    if (course && course.nextStep && course.nextStep.topicId) {
      actions.push({ label: 'Seguir lección actual', href: courseUrl(course.courseId, course.nextStep.topicId) });
    }
    if (course && course.reviewTargetTopicId && (!course.nextStep || course.reviewTargetTopicId !== course.nextStep.topicId)) {
      actions.push({ label: 'Abrir repaso prioritario', href: courseUrl(course.courseId, course.reviewTargetTopicId) });
    }
    if (course && course.bookmarkTargetTopicId && course.bookmarkTargetTopicId !== course.reviewTargetTopicId && (!course.nextStep || course.bookmarkTargetTopicId !== course.nextStep.topicId)) {
      actions.push({ label: 'Ir al último bookmark', href: courseUrl(course.courseId, course.bookmarkTargetTopicId) });
    }
    if (course && course.noteTargetTopicId && course.noteTargetTopicId !== course.bookmarkTargetTopicId && course.noteTargetTopicId !== course.reviewTargetTopicId && (!course.nextStep || course.noteTargetTopicId !== course.nextStep.topicId)) {
      actions.push({ label: 'Retomar desde tus notas', href: courseUrl(course.courseId, course.noteTargetTopicId) });
    }
    const canOpenInterview = Boolean(
      courseId &&
      INTERVIEW_PACKS[courseId] &&
      (state.local || (access && access.access === 'full') || (state.access[courseId] && state.access[courseId].access === 'full'))
    );
    if (canOpenInterview) {
      actions.push({ label: 'Modo entrevista', href: courseInterviewUrl(courseId, INTERVIEW_PACKS[courseId].sourceTopicIds[0] || '') });
    }
    if (!actions.length) return '';
    return `<div class="hub-inline-actions hub-course-quick-actions">${actions.slice(0, 3).map(function (action) { return `<a class="hub-chip" href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a>`; }).join('')}</div>`;
  }

  function readAuthState() {
    const session = window.SMAAuth && typeof window.SMAAuth.getSession === 'function' ? window.SMAAuth.getSession() : null;
    const user = window.SMAAuth && typeof window.SMAAuth.getUser === 'function' ? window.SMAAuth.getUser() : null;
    const accessToken = resolveAccessToken(session);
    const tokenUsable = Boolean(accessToken) && isSessionTokenUsable(accessToken);
    const resolvedUser = tokenUsable ? (user || resolveAuthUserFromToken(accessToken)) : null;
    const effectiveSession = tokenUsable ? session : null;
    const hasToken = tokenUsable;
    return {
      loggedIn: hasToken,
      user: resolvedUser,
      session: effectiveSession,
      tokenAwareUser: Boolean(resolvedUser && resolvedUser.id),
      hasAuthToken: hasToken
    };
  }

  function resolveAccessToken(session) {
    return String(session && (session.accessToken || session.access_token || session.token) || '').trim();
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

  function resolveAuthUserFromToken(accessToken) {
    const payload = decodeJwtPayload(accessToken);
    if (!payload || typeof payload !== 'object') return null;
    const id = String(payload.sub || payload.user_id || payload.uid || '').trim();
    if (!id) return null;
    return {
      id: id,
      email: String(payload.email || payload.user_email || payload.preferred_username || '').trim()
    };
  }

  function isSessionTokenUsable(accessToken) {
    const payload = decodeJwtPayload(accessToken);
    if (!payload || typeof payload !== 'object') return true;
    const exp = Number(payload.exp);
    if (!Number.isFinite(exp)) return true;
    return exp * 1000 > Date.now();
  }

  function withAuthHeader(headers, session) {
    const accessToken = resolveAccessToken(session);
    if (!accessToken) return false;
    headers.Authorization = `Bearer ${accessToken}`;
    return true;
  }

  async function requestJson(url, options) {
    const settings = options || {};
    const headers = {};
    if (settings.auth) {
      if (!withAuthHeader(headers, state.auth.session)) {
        const error = new Error('No hay sesión activa.');
        error.statusCode = 401;
        throw error;
      }
    }
    const response = await fetch(url, { method: settings.method || 'GET', headers: headers });
    const payload = await response.json().catch(function () { return null; });
    if (!response.ok || !payload || payload.ok === false) {
      const error = new Error(payload && payload.error ? payload.error : `Error ${response.status}`);
      error.statusCode = response.status;
      throw error;
    }
    return payload;
  }

  function courseUrl(courseId, topicId) {
    const meta = COURSE_META[courseId];
    if (!meta) return './index.html';
    const hash = topicId ? `#${encodeURIComponent(topicId)}` : '';
    return `${meta.path}${hash}`;
  }

  function courseInterviewUrl(courseId, topicId) {
    const meta = COURSE_META[courseId];
    if (!meta) return './index.html';
    const hash = topicId ? `#${encodeURIComponent(topicId)}` : '';
    return `${meta.path}?mode=interview${hash}`;
  }

  function loginUrl(nextPath) {
    const target = new URL('./auth/login.html', window.location.href);
    if (nextPath) target.searchParams.set('next', toRelativeTarget(nextPath));
    return target.pathname + target.search + target.hash;
  }

  function toRelativeTarget(value) {
    try {
      const target = new URL(value, window.location.href);
      return `${target.pathname}${target.search}${target.hash}`;
    } catch (_error) {
      return '/index.html';
    }
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

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function createButton(label, href, className, onClick) {
    const link = document.createElement('a');
    link.className = className;
    link.href = href;
    link.textContent = label;
    if (typeof onClick === 'function') {
      link.addEventListener('click', onClick);
    }
    return link;
  }

  function createTag(label, access, className, role) {
    const span = document.createElement('span');
    span.className = className;
    if (access) span.dataset.access = access;
    if (role) span.dataset.role = role;
    span.textContent = label;
    return span;
  }

  function badgeHtml(label, access, className) {
    return `<span class=\"${escapeHtml(className)}\" data-access=\"${escapeHtml(access)}\">${escapeHtml(label)}</span>`;
  }

  function miniStat(label, value) {
    return `<div class="hub-mini-stat"><p class="hub-mini-label">${escapeHtml(label)}</p><p class="hub-mini-value">${escapeHtml(value)}</p></div>`;
  }

  function roleLabel(role) {
    if (role === 'admin') return 'Cuenta admin';
    if (role === 'trial') return 'Cuenta trial';
    if (role === 'student') return 'Cuenta estudiante';
    return 'Invitado';
  }

  function accessLabel(access) {
    if (access === 'full') return 'Acceso completo';
    if (access === 'teaser') return 'Modo teaser';
    return 'Bloqueado';
  }

  function courseLabel(courseId) {
    return COURSE_META[courseId] ? COURSE_META[courseId].label : courseId;
  }

  function setStatus(text, tone) {
    if (!els.statusBox) return;
    els.statusBox.textContent = text || '';
    els.statusBox.dataset.tone = tone || 'ok';
    els.statusBox.classList.toggle('is-visible', Boolean(text));
  }
})();
