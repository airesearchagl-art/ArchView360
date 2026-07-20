// Regression tests for tests/server.js's path-traversal defenses.
//
// These deliberately do NOT use Playwright's `request` fixture (or curl):
// both normalize ".." dot-segments client-side per the URL/fetch spec
// before a request ever reaches the wire, which would silently mask a
// server-side bug rather than exercise it. A raw TCP request line is the
// only way to send a genuinely unnormalized path, which is also exactly
// what a non-browser HTTP client (curl --path-as-is, a raw script, etc.)
// can send in practice.
const { test, expect } = require('@playwright/test');
const net = require('net');

const PORT = 4173; // matches playwright.config.js's webServer port

function rawRequest(target) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(PORT, '127.0.0.1', () => {
      sock.write(`GET ${target} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n`);
    });
    let buf = '';
    sock.on('data', (d) => { buf += d.toString(); });
    sock.on('end', () => {
      const statusLine = buf.split('\r\n')[0] || '';
      const match = statusLine.match(/^HTTP\/1\.\d (\d+)/);
      resolve({ status: match ? Number(match[1]) : null, raw: buf });
    });
    sock.on('error', reject);
  });
}

test.describe('static test server: path traversal defenses', () => {
  test('rejects literal .. traversal', async () => {
    const res = await rawRequest('/../package.json');
    expect(res.status).toBe(400);
  });

  test('rejects percent-encoded .. traversal', async () => {
    const res = await rawRequest('/%2e%2e/package.json');
    expect(res.status).toBe(400);
  });

  test('rejects nested .. traversal', async () => {
    const res = await rawRequest('/tests/../../package.json');
    expect(res.status).toBe(400);
  });

  test('rejects an encoded slash hiding a traversal segment', async () => {
    const res = await rawRequest('/%2e%2e%2fpackage.json');
    expect(res.status).toBe(400);
  });

  test('rejects a request containing a null byte', async () => {
    const res = await rawRequest('/%00');
    expect(res.status).toBe(400);
  });

  test('rejects malformed percent-encoding without crashing the server', async () => {
    const res = await rawRequest('/%');
    expect(res.status).toBe(400);
    // A crash would leave the next request with no server to answer.
    const followUp = await rawRequest('/index.html');
    expect(followUp.status).toBe(200);
  });

  test('serves a root-level file directly (by design — the repo root is the web root)', async () => {
    const res = await rawRequest('/package.json');
    expect(res.status).toBe(200);
  });

  test('query strings are accepted and ignored for path resolution', async () => {
    const res = await rawRequest('/index.html?v=test');
    expect(res.status).toBe(200);
  });

  test('favicon.ico is answered with 204, not a console-noisy 404', async () => {
    const res = await rawRequest('/favicon.ico');
    expect(res.status).toBe(204);
  });

  test('unknown paths return 404, not a directory listing', async () => {
    const res = await rawRequest('/nonexistent-file-xyz.html');
    expect(res.status).toBe(404);
  });

  test('a directory path returns 404, never a listing', async () => {
    const res = await rawRequest('/tests/');
    expect(res.status).toBe(404);
  });

  test('/ and /index.html both serve the app shell', async () => {
    expect((await rawRequest('/')).status).toBe(200);
    expect((await rawRequest('/index.html')).status).toBe(200);
  });
});
