const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const baseUrl = (process.env.SMA_INTERVIEW_SMOKE_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const artifactDir = path.resolve(process.env.SMA_INTERVIEW_SMOKE_ARTIFACT_DIR || 'output/playwright/interview-mode-smoke');

const courses = [
  {
    key: 'ios',
    url: `${baseUrl}/ios/index.html?mode=interview`,
    viewport: { width: 390, height: 844 }
  },
  {
    key: 'android',
    url: `${baseUrl}/android/index.html?mode=interview`
  },
  {
    key: 'sdd',
    url: `${baseUrl}/sdd/index.html?mode=interview`
  }
];

async function ensureArtifactDir() {
  await fs.mkdir(artifactDir, { recursive: true });
}

async function readHubInterviewLinks(page) {
  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#hub-courses-grid', { timeout: 20000 });
  return await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('#hub-courses-grid a'))
      .map((anchor) => ({
        text: String(anchor.textContent || '').trim(),
        href: String(anchor.getAttribute('href') || '')
      }))
      .filter((item) => item.text.includes('Modo entrevista'));
    return {
      count: links.length,
      hrefs: links.map((item) => item.href)
    };
  });
}

async function readCourseInterviewState(page, course) {
  if (course.viewport) {
    await page.setViewportSize(course.viewport);
  }

  await page.goto(course.url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#study-interview-panel:not([hidden])', { timeout: 20000 });
  await page.waitForSelector('#study-interview-toggle', { timeout: 20000 });

  const state = await page.evaluate(() => {
    const panel = document.getElementById('study-interview-panel');
    const toggle = document.getElementById('study-interview-toggle');
    const chips = Array.from(document.querySelectorAll('.study-interview-chip'));
    const sources = Array.from(document.querySelectorAll('[data-interview-source]'));
    const question = document.querySelector('.study-interview-question');
    const current = document.querySelector('.study-interview-current');
    const reveal = document.getElementById('study-interview-reveal');

    return {
      openLabel: String(toggle ? toggle.textContent || '' : '').trim(),
      panelVisible: !!panel && !panel.hidden,
      chipCount: chips.length,
      sourceCount: sources.length,
      hasQuestion: !!question && String(question.textContent || '').trim().length > 0,
      hasCurrent: !!current && String(current.textContent || '').trim().length > 0,
      revealLabel: String(reveal ? reveal.textContent || '' : '').trim()
    };
  });

  await page.screenshot({
    path: path.join(artifactDir, `${course.key}-interview.png`),
    fullPage: false
  });

  return state;
}

async function run() {
  await ensureArtifactDir();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const hubPage = await context.newPage();

  try {
    const hubLinks = await readHubInterviewLinks(hubPage);
    assert.ok(hubLinks.count >= 3, `Se esperaban al menos 3 accesos de modo entrevista en el Hub y llegaron ${hubLinks.count}`);

    for (const course of courses) {
      const page = await context.newPage();
      try {
        const state = await readCourseInterviewState(page, course);
        assert.equal(state.panelVisible, true, `${course.key}: el panel de entrevista debe estar visible`);
        assert.equal(state.hasQuestion, true, `${course.key}: debe existir una pregunta de entrevista`);
        assert.equal(state.hasCurrent, true, `${course.key}: debe existir recomendación actual`);
        assert.ok(state.chipCount >= 1, `${course.key}: debe existir al menos un chip de prompt`);
        assert.ok(state.sourceCount >= 1, `${course.key}: debe existir al menos una lección fuente`);
        assert.match(state.openLabel, /Entrevista/i, `${course.key}: el botón debe reflejar modo entrevista`);
        assert.notEqual(state.revealLabel, '', `${course.key}: el botón de rúbrica no puede quedar vacío`);
      } finally {
        await page.close();
      }
    }

    console.log('[PASS] interview mode smoke');
  } finally {
    await context.close();
    await browser.close();
  }
}

run().catch((error) => {
  console.error('[FAIL] interview mode smoke');
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
