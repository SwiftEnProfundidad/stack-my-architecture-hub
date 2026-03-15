const DEFAULT_REMOTE_BASE_URL = 'https://architecture-stack.vercel.app';

const { sendJson, setCorsHeaders } = require('./_hub-platform.js');

const REMOTE_API_BASE_URL = String(process.env.HUB_REMOTE_BASE_URL || process.env.HUB_API_BASE_URL || DEFAULT_REMOTE_BASE_URL).trim().replace(/\/$/, '');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    const rewrittenPath = readQueryParam(req, 'path');
    const fallbackPath = extractFallbackPath(req.url);
    const targetPath = normalizePath(rewrittenPath || fallbackPath);
    if (!targetPath) {
      sendJson(res, 400, {
        ok: false,
        error: 'Ruta de proxy inválida.'
      });
      return;
    }

    const targetSearch = cloneSearchWithoutPath(req.url, 'path');
    const targetUrl = `${REMOTE_API_BASE_URL}/api/${targetPath}${targetSearch ? `?${targetSearch}` : ''}`;

    const headers = buildForwardHeaders(req);
    const body = shouldSendBody(req.method) ? await readRawBody(req) : undefined;
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body
    });

    const payload = await response.text();
    res.status(response.status);
    const responseContentType = response.headers.get('content-type');
    res.setHeader('Content-Type', responseContentType || 'application/json; charset=utf-8');
    res.end(payload || '');
  } catch (error) {
    sendJson(res, 502, {
      ok: false,
      error: error && error.message ? String(error.message) : 'Error de proxy al backend remoto.'
    });
  }
};

function readQueryParam(req, name) {
  try {
    const parsed = new URL(req.url || '/', 'https://localhost');
    return String((parsed.searchParams.get(name) || '')).trim();
  } catch (_error) {
    return '';
  }
}

function cloneSearchWithoutPath(url, name) {
  try {
    const parsed = new URL(url || '/', 'https://localhost');
    const output = new URLSearchParams();
    parsed.searchParams.forEach((value, key) => {
      if (key !== name) output.set(key, String(value || ''));
    });
    return output.toString();
  } catch (_error) {
    return '';
  }
}

function extractFallbackPath(url) {
  try {
    const parsed = new URL(url || '/', 'https://localhost');
    const remainder = String(parsed.pathname || '').trim();
    return normalizePath(remainder.replace(/^\/api\/proxy\/?/, ''));
  } catch (_error) {
    return '';
  }
}

function normalizePath(value) {
  return String(value || '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\/{2,}/g, '/')
    .replace(/\.\.\/?/g, '')
    .trim();
}

function shouldSendBody(method) {
  if (!method) return false;
  const safe = String(method).toUpperCase();
  return safe !== 'GET' && safe !== 'HEAD' && safe !== 'OPTIONS';
}

function buildForwardHeaders(req) {
  const headers = {};
  const raw = req.headers || {};
  Object.keys(raw).forEach((name) => {
    const value = raw[name];
    if (typeof value === 'undefined' || value === null) return;
    const lower = String(name).toLowerCase();
    if (lower === 'host' || lower === 'connection' || lower === 'content-length') {
      return;
    }
    headers[name] = Array.isArray(value) ? value.join(',') : String(value);
  });
  return headers;
}

function readRawBody(req) {
  return new Promise((resolve) => {
    if (!req || typeof req.on !== 'function') {
      resolve('');
      return;
    }
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', () => resolve(''));
  });
}
