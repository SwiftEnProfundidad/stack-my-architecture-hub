'use strict';

const path = require('node:path');

function loadHandler(relativeHandlerPath, envOverrides = {}) {
  const handlerPath = path.resolve(__dirname, '../../..', relativeHandlerPath);
  const apiRoot = path.resolve(__dirname, '../../..', 'api') + path.sep;
  const previous = {};
  const keys = Object.keys(envOverrides);

  keys.forEach((key) => {
    previous[key] = process.env[key];
    const value = envOverrides[key];
    if (value === undefined || value === null) {
      delete process.env[key];
      return;
    }
    process.env[key] = String(value);
  });

  Object.keys(require.cache).forEach((cacheKey) => {
    if (cacheKey === handlerPath || cacheKey.startsWith(apiRoot)) {
      delete require.cache[cacheKey];
    }
  });
  const handler = require(handlerPath);

  keys.forEach((key) => {
    if (previous[key] === undefined) {
      delete process.env[key];
      return;
    }
    process.env[key] = previous[key];
  });

  return handler;
}

async function invoke(handler, { method = 'GET', url = '/', body, headers } = {}) {
  const req = {
    method,
    url,
    body,
    headers: headers || {}
  };

  return await new Promise((resolve, reject) => {
    const responseHeaders = {};
    const res = {
      statusCode: 200,
      setHeader(name, value) {
        responseHeaders[String(name).toLowerCase()] = String(value);
      },
      status(code) {
        this.statusCode = Number(code);
        return this;
      },
      end(payload = '') {
        const rawBody = String(payload || '');
        let json = null;
        try {
          json = JSON.parse(rawBody);
        } catch (_error) {
          json = null;
        }
        resolve({
          statusCode: this.statusCode,
          headers: responseHeaders,
          rawBody,
          json
        });
      }
    };

    Promise.resolve(handler(req, res)).catch(reject);
  });
}

async function withMockFetch(mockFetch, fn) {
  const originalFetch = global.fetch;
  global.fetch = mockFetch;
  try {
    return await fn();
  } finally {
    global.fetch = originalFetch;
  }
}

module.exports = {
  loadHandler,
  invoke,
  withMockFetch
};
