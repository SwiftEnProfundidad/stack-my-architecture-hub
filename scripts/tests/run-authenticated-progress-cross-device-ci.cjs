const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const baseUrl = process.env.SMA_E2E_BASE_URL || 'https://architecture-stack.vercel.app';
const coursePath = process.env.SMA_E2E_COURSE_PATH || '/ios/index.html';
const courseId = process.env.SMA_E2E_COURSE_ID || 'stack-my-architecture-ios';
const topicId = process.env.SMA_E2E_TOPIC_ID || '01-fundamentos-00-introduccion';
const email = process.env.SMA_E2E_AUTH_EMAIL || '';
const password = process.env.SMA_E2E_AUTH_PASSWORD || '';
const artifactDir = path.resolve(process.env.SMA_E2E_ARTIFACT_DIR || 'output/playwright-ci-auth-e2e');

function buildLoginUrl() {
  return `${baseUrl.replace(/\/$/, '')}/auth/login.html?next=${encodeURIComponent(`${coursePath}#${topicId}`)}`;
}

async function ensureArtifactDir() {
  await fs.mkdir(artifactDir, { recursive: true });
}

async function readTopicState(page) {
  return await page.evaluate(({ activeCourseId, activeTopicId }) => {
    const authUserKey = 'sma:auth:user:v1';
    const authSessionKey = 'sma:auth:session:v1';
    const completedKey = `sma:${activeCourseId}:topics:completed`;
    const reviewKey = `sma:${activeCourseId}:topics:review`;
    const completed = JSON.parse(localStorage.getItem(completedKey) || '{}');
    const review = JSON.parse(localStorage.getItem(reviewKey) || '{}');
    const authUser = JSON.parse(localStorage.getItem(authUserKey) || 'null');
    const authSession = JSON.parse(localStorage.getItem(authSessionKey) || 'null');
    const link = document.querySelector(`a.doc-nav-link[data-topic-id="${activeTopicId}"]`) || document.querySelector(`a.doc-nav-link[href="#${activeTopicId}"]`);
    return {
      authReady: !!(authUser && authUser.id && authSession && authSession.accessToken),
      userId: authUser && authUser.id ? String(authUser.id) : '',
      done: !!completed[activeTopicId],
      review: !!review[activeTopicId],
      hasDoneBadge: !!(link && link.querySelector('.study-ux-completed-badge')),
      hasReviewBadge: !!(link && link.querySelector('.study-ux-review-badge')),
      progressText: (document.getElementById('study-progress') || {}).textContent || '',
      completionLabel: ((document.getElementById('study-completion-toggle') || {}).textContent || '').trim(),
      reviewLabel: ((document.getElementById('study-review-toggle') || {}).textContent || '').trim()
    };
  }, { activeCourseId: courseId, activeTopicId: topicId });
}

async function waitForSyncPost(page) {
  await page.waitForResponse((candidate) => {
    return candidate.request().method() === 'POST' && candidate.url().includes('/api/progress-sync');
  }, { timeout: 15000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(300);
}

async function toggleAndSync(page, selector) {
  const sync = waitForSyncPost(page);
  await page.locator(selector).click();
  await sync;
}

async function ensureDesiredState(page, desiredDone, desiredReview) {
  let state = await readTopicState(page);

  if (state.done !== desiredDone) {
    await toggleAndSync(page, '#study-completion-toggle');
  }

  state = await readTopicState(page);

  if (state.review !== desiredReview) {
    await toggleAndSync(page, '#study-review-toggle');
  }

  await page.waitForFunction(({ activeCourseId, activeTopicId, targetDone, targetReview }) => {
    const completedKey = `sma:${activeCourseId}:topics:completed`;
    const reviewKey = `sma:${activeCourseId}:topics:review`;
    const completed = JSON.parse(localStorage.getItem(completedKey) || '{}');
    const review = JSON.parse(localStorage.getItem(reviewKey) || '{}');
    return !!completed[activeTopicId] === targetDone && !!review[activeTopicId] === targetReview;
  }, { activeCourseId: courseId, activeTopicId: topicId, targetDone: desiredDone, targetReview: desiredReview }, { timeout: 20000 });

  return await readTopicState(page);
}

async function loginAndOpenCourse(page) {
  await page.goto(buildLoginUrl(), { waitUntil: 'networkidle' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);

  await Promise.all([
    page.waitForURL((url) => url.pathname === coursePath, { timeout: 20000 }),
    page.locator('#login-form button[type="submit"]').click()
  ]);

  await page.waitForSelector('#study-completion-toggle', { timeout: 20000 });
  await page.waitForLoadState('networkidle').catch(() => {});

  const state = await readTopicState(page);
  return {
    ...state,
    hasProfileQuery: page.url().includes('progressProfile='),
    url: page.url()
  };
}

async function run() {
  assert.ok(email, 'SMA_E2E_AUTH_EMAIL es obligatorio');
  assert.ok(password, 'SMA_E2E_AUTH_PASSWORD es obligatorio');
  await ensureArtifactDir();

  const browser = await chromium.launch({ headless: true });
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  let initialDone = false;
  let initialReview = false;
  let restoreError = null;

  try {
    console.log(`[CI-E2E] Base URL: ${baseUrl}`);
    console.log(`[CI-E2E] Course: ${coursePath}`);
    console.log(`[CI-E2E] Topic: ${topicId}`);

    const loginA = await loginAndOpenCourse(pageA);
    assert.equal(loginA.authReady, true, 'device-a debe iniciar con sesión autenticada');
    assert.equal(loginA.hasProfileQuery, false, 'no debe existir progressProfile en URL autenticada');
    assert.notEqual(loginA.userId, '', 'device-a debe exponer user id');

    initialDone = loginA.done;
    initialReview = loginA.review;

    const forcedState = await ensureDesiredState(pageA, true, true);
    assert.equal(forcedState.done, true, 'device-a debe quedar completado');
    assert.equal(forcedState.review, true, 'device-a debe quedar marcado para repaso');
    await pageA.screenshot({ path: path.join(artifactDir, 'device-a-after-mutation.png'), fullPage: false });

    const loginB = await loginAndOpenCourse(pageB);
    assert.equal(loginB.authReady, true, 'device-b debe iniciar con sesión autenticada');
    assert.equal(loginB.hasProfileQuery, false, 'device-b no debe exponer progressProfile');

    await pageB.waitForFunction(({ activeCourseId, activeTopicId }) => {
      const completedKey = `sma:${activeCourseId}:topics:completed`;
      const reviewKey = `sma:${activeCourseId}:topics:review`;
      const completed = JSON.parse(localStorage.getItem(completedKey) || '{}');
      const review = JSON.parse(localStorage.getItem(reviewKey) || '{}');
      return !!completed[activeTopicId] && !!review[activeTopicId];
    }, { activeCourseId: courseId, activeTopicId: topicId }, { timeout: 20000 });

    const syncedState = await readTopicState(pageB);
    assert.equal(syncedState.done, true, 'device-b debe reflejar completado');
    assert.equal(syncedState.review, true, 'device-b debe reflejar repaso');
    assert.equal(syncedState.hasDoneBadge, true, 'device-b debe mostrar badge completado');
    assert.equal(syncedState.hasReviewBadge, true, 'device-b debe mostrar badge repaso');
    await pageB.screenshot({ path: path.join(artifactDir, 'device-b-synced.png'), fullPage: false });

    console.log('[CI-E2E] Authenticated progress sync PASS');
  } finally {
    try {
      await ensureDesiredState(pageA, initialDone, initialReview);
    } catch (error) {
      restoreError = error;
    }

    await contextA.close();
    await contextB.close();
    await browser.close();

    if (restoreError) throw restoreError;
  }
}

run().catch((error) => {
  console.error('[CI-E2E] Authenticated progress sync FAIL');
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
