'use strict';

const {
  COURSE_IDS,
  DEFAULT_BOOKMARKS_TABLE,
  DEFAULT_ENTITLEMENTS_TABLE,
  DEFAULT_NOTES_TABLE,
  DEFAULT_ROLE_TABLE,
  DEFAULT_TEASERS_TABLE,
  fetchOptionalRows,
  inferCourseStageSummary,
  isBackendConfigured,
  mapAllowedCourses,
  normalizeCourseId,
  normalizeTableName,
  resolveUserContext,
  sendJson,
  setCorsHeaders,
  toErrorMessage,
  toStatusCode
} = require('./_hub-platform.js');

const ROLE_TABLE = normalizeTableName(process.env.HUB_ROLE_TABLE, DEFAULT_ROLE_TABLE);
const ENTITLEMENTS_TABLE = normalizeTableName(process.env.HUB_ENTITLEMENTS_TABLE, DEFAULT_ENTITLEMENTS_TABLE);
const TEASERS_TABLE = normalizeTableName(process.env.HUB_TEASERS_TABLE, DEFAULT_TEASERS_TABLE);
const NOTES_TABLE = normalizeTableName(process.env.HUB_NOTES_TABLE, DEFAULT_NOTES_TABLE);
const BOOKMARKS_TABLE = normalizeTableName(process.env.HUB_BOOKMARKS_TABLE, DEFAULT_BOOKMARKS_TABLE);
const PROGRESS_TABLE = normalizeTableName(process.env.PROGRESS_SYNC_TABLE, 'course_progress');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    await handleMe(req, res);
    return;
  }

  sendJson(res, 404, {
    ok: false,
    error: 'Ruta no encontrada para dashboard.'
  });
};

async function handleMe(req, res) {
  if (!isBackendConfigured()) {
    sendJson(res, 503, {
      ok: false,
      error: 'Backend de dashboard no configurado en este entorno.'
    });
    return;
  }

  try {
    const context = await resolveUserContext(req, {
      roleTable: ROLE_TABLE,
      entitlementsTable: ENTITLEMENTS_TABLE
    });

    if (!context.authenticated) {
      const error = new Error('Se requiere sesión autenticada.');
      error.statusCode = 401;
      throw error;
    }

    const [progressRows, notesRows, bookmarkRows, teaserRows] = await Promise.all([
      fetchOptionalRows(PROGRESS_TABLE, {
        select: 'course_id,updated_at,data',
        profile_key: `eq.${context.user.id}`,
        order: 'course_id.asc'
      }),
      fetchOptionalRows(NOTES_TABLE, {
        select: 'course_id,topic_id,content,updated_at',
        user_id: `eq.${context.user.id}`
      }),
      fetchOptionalRows(BOOKMARKS_TABLE, {
        select: 'course_id,topic_id,updated_at',
        user_id: `eq.${context.user.id}`
      }),
      fetchOptionalRows(TEASERS_TABLE, {
        select: 'course_id,topic_id,is_public',
        is_public: 'eq.true'
      })
    ]);

    const allowedCourses = mapAllowedCourses(context);
    const progressByCourse = new Map();
    progressRows.forEach((row) => {
      const courseId = normalizeCourseId(row.course_id);
      if (!courseId) return;
      progressByCourse.set(courseId, row);
    });

    const noteCounts = countByCourse(notesRows);
    const bookmarkCounts = countByCourse(bookmarkRows);
    const teaserCounts = countByCourse(teaserRows);
    const recentNotes = notesRows
      .map((row) => ({
        courseId: normalizeCourseId(row.course_id),
        topicId: String(row.topic_id || ''),
        updatedAt: String(row.updated_at || ''),
        preview: String(row.content || '').trim().slice(0, 180)
      }))
      .filter((row) => row.courseId && row.topicId)
      .sort(sortByUpdatedAtDesc)
      .slice(0, 5);

    const recentBookmarks = bookmarkRows
      .map((row) => ({
        courseId: normalizeCourseId(row.course_id),
        topicId: String(row.topic_id || ''),
        updatedAt: String(row.updated_at || '')
      }))
      .filter((row) => row.courseId && row.topicId)
      .sort(sortByUpdatedAtDesc)
      .slice(0, 5);

    const courses = COURSE_IDS.map((courseId) => {
      const row = progressByCourse.get(courseId) || null;
      const data = row && row.data && typeof row.data === 'object' ? row.data : {};
      const completed = data.completed && typeof data.completed === 'object' ? data.completed : {};
      const review = data.review && typeof data.review === 'object' ? data.review : {};
      const completedCount = Object.keys(completed).length;
      const reviewCount = Object.keys(review).length;
      const access = allowedCourses.includes(courseId) ? 'full' : (teaserCounts.get(courseId) ? 'teaser' : 'blocked');
      const stageSummary = inferCourseStageSummary(courseId, data);
      return {
        courseId,
        access,
        allowed: access !== 'blocked',
        completedCount,
        reviewCount,
        lastTopic: String(data.lastTopic || ''),
        updatedAt: row ? String(row.updated_at || '') : '',
        noteCount: noteCounts.get(courseId) || 0,
        bookmarkCount: bookmarkCounts.get(courseId) || 0,
        teaserCount: teaserCounts.get(courseId) || 0,
        currentStageId: stageSummary.currentStageId,
        currentStageLabel: stageSummary.currentStageLabel,
        completedCheckpoints: stageSummary.completedCheckpoints,
        totalCheckpoints: stageSummary.totalCheckpoints,
        nextStageLabel: stageSummary.nextStageLabel,
        nextStep: buildNextStep(courseId, data, access)
      };
    });

    const nextCourse = courses.find((item) => item.allowed && item.nextStep.topicId) || courses.find((item) => item.allowed) || null;
    const reviewQueue = courses
      .filter((course) => course.allowed)
      .flatMap((course) => buildReviewQueue(course.courseId, progressByCourse.get(course.courseId)))
      .sort(sortByUpdatedAtDesc)
      .slice(0, 6);

    sendJson(res, 200, {
      ok: true,
      user: context.user,
      role: context.role,
      allowedCourses,
      entitlements: context.entitlements,
      courses,
      notes: recentNotes,
      bookmarks: recentBookmarks,
      reviewQueue,
      nextStep: nextCourse ? {
        courseId: nextCourse.courseId,
        topicId: nextCourse.nextStep.topicId,
        label: nextCourse.nextStep.label
      } : null
    });
  } catch (error) {
    sendJson(res, toStatusCode(error), {
      ok: false,
      error: toErrorMessage(error)
    });
  }
}

function countByCourse(rows) {
  const output = new Map();
  rows.forEach((row) => {
    const courseId = normalizeCourseId(row.course_id);
    if (!courseId) return;
    output.set(courseId, (output.get(courseId) || 0) + 1);
  });
  return output;
}

function buildNextStep(courseId, data, access) {
  if (access === 'blocked') {
    return {
      topicId: null,
      label: 'Solicita acceso para desbloquear este curso.'
    };
  }

  const lastTopic = String(data.lastTopic || '').trim();
  if (lastTopic) {
    return {
      topicId: lastTopic,
      label: 'Continuar donde lo dejaste.'
    };
  }

  return {
    topicId: null,
    label: access === 'teaser' ? 'Explora la muestra pública del curso.' : `Continúa el curso ${courseId}.`
  };
}

function buildReviewQueue(courseId, progressRow) {
  const data = progressRow && progressRow.data && typeof progressRow.data === 'object' ? progressRow.data : {};
  const review = data.review && typeof data.review === 'object' ? data.review : {};
  const updatedAt = progressRow ? String(progressRow.updated_at || '') : '';
  return Object.keys(review)
    .filter((topicId) => review[topicId])
    .map((topicId) => ({
      courseId,
      topicId: String(topicId),
      updatedAt
    }));
}

function sortByUpdatedAtDesc(a, b) {
  return Date.parse(String(b.updatedAt || '')) - Date.parse(String(a.updatedAt || ''));
}
