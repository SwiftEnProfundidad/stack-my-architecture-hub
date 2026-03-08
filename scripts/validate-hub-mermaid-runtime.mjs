#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const puppeteer = require('/opt/homebrew/lib/node_modules/@mermaid-js/mermaid-cli/node_modules/puppeteer');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HUB_ROOT = path.resolve(__dirname, '..');

const COURSE_PAGES = [
  { id: 'ios', htmlPath: path.join(HUB_ROOT, 'ios', 'index.html') },
  { id: 'android', htmlPath: path.join(HUB_ROOT, 'android', 'index.html') },
  { id: 'sdd', htmlPath: path.join(HUB_ROOT, 'sdd', 'index.html') },
];

const MERMAID_BROWSER_SRC = process.env.SMA_MERMAID_BROWSER_SRC || 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
const FLOWCHART_KNOWN_RUNTIME_RISKS = ['-.o', '--o'];
const LEGEND_VARIANTS = ['direct-closed', 'dashed-closed', 'contract-open', 'solid-open'];
const MERMAID_BLOCK_RE = /<pre class="mermaid">([\s\S]*?)<\/pre>/gi;

function decodeHtml(input) {
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractMermaidBlocks(html) {
  const blocks = [];
  let match;
  while ((match = MERMAID_BLOCK_RE.exec(html)) !== null) {
    blocks.push(decodeHtml(match[1]).trim());
  }
  return blocks;
}

function assertSvgLegends(courseId, html) {
  if (html.includes('<i class="sma-arrow')) {
    throw new Error(`[${courseId}] detectada leyenda Mermaid legacy con <i class="sma-arrow">.`);
  }
  if (!html.includes('class="sma-mermaid-legend"')) {
    throw new Error(`[${courseId}] no contiene ninguna leyenda Mermaid.`);
  }
  for (const variant of LEGEND_VARIANTS) {
    if (!html.includes(`class="sma-legend-arrow ${variant}`)) {
      throw new Error(`[${courseId}] falta variante SVG en leyenda: ${variant}`);
    }
  }
}

function assertNoKnownFlowchartRisks(courseId, blocks) {
  for (const [index, block] of blocks.entries()) {
    const normalized = block.trim().toLowerCase();
    if (!normalized.startsWith('flowchart') && !normalized.startsWith('graph')) continue;
    for (const token of FLOWCHART_KNOWN_RUNTIME_RISKS) {
      if (normalized.includes(token)) {
        throw new Error(`[${courseId}] bloque Mermaid #${index + 1} conserva token de riesgo Mermaid@10 (${token}).`);
      }
    }
  }
}

function uniqueBlocks(blocks) {
  const unique = [];
  const seen = new Set();
  for (const block of blocks) {
    const hash = crypto.createHash('sha1').update(block).digest('hex');
    if (seen.has(hash)) continue;
    seen.add(hash);
    unique.push({ hash, code: block });
  }
  return unique;
}

async function preparePage(page) {
  await page.goto('about:blank');
  await page.addScriptTag({ url: MERMAID_BROWSER_SRC });
  await page.evaluate(() => {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });
  });
}

async function parseBlocksInBrowser(page, courseId, blocks) {
  const payload = blocks.map((item) => ({ hash: item.hash, code: item.code }));
  const result = await page.evaluate(async ({ inputBlocks }) => {
    const failures = [];
    let parsed = 0;
    for (const block of inputBlocks) {
      try {
        await mermaid.parse(block.code, { suppressErrors: false });
        parsed += 1;
      } catch (error) {
        failures.push({
          hash: block.hash,
          message: error?.str || error?.message || String(error),
          preview: block.code.split('\n').slice(0, 6).join('\n'),
        });
        if (failures.length >= 10) break;
      }
    }
    return { parsed, failures };
  }, { inputBlocks: payload });

  if (result.failures.length > 0) {
    const lines = result.failures.map((failure, index) => {
      return [
        `  ${index + 1}. hash=${failure.hash}`,
        `     error=${failure.message}`,
        `     preview=${failure.preview.replace(/\n/g, ' | ')}`,
      ].join('\n');
    }).join('\n');
    throw new Error(`[${courseId}] Mermaid parse fallo en ${result.failures.length} bloques únicos.\n${lines}`);
  }

  return { parsedCount: result.parsed };
}

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await preparePage(page);

    let totalBlocks = 0;
    let totalUnique = 0;

    for (const course of COURSE_PAGES) {
      if (!fs.existsSync(course.htmlPath)) {
        throw new Error(`[${course.id}] falta HTML publicado: ${course.htmlPath}`);
      }

      const html = fs.readFileSync(course.htmlPath, 'utf-8');
      assertSvgLegends(course.id, html);
      const blocks = extractMermaidBlocks(html);
      if (blocks.length === 0) {
        throw new Error(`[${course.id}] no contiene bloques Mermaid publicados.`);
      }
      assertNoKnownFlowchartRisks(course.id, blocks);
      const uniques = uniqueBlocks(blocks);
      const stats = await parseBlocksInBrowser(page, course.id, uniques);
      totalBlocks += blocks.length;
      totalUnique += uniques.length;
      console.log(`[OK] ${course.id}: Mermaid parse=${stats.parsedCount}/${uniques.length} únicos, bloques=${blocks.length}, leyenda SVG verificada`);
    }

    console.log(`[OK] Validación Mermaid hub completada. bloques=${totalBlocks}, unicos=${totalUnique}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`[ERROR] ${error.message}`);
  process.exit(1);
});
