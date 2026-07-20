// Minimal static file server for local Playwright test runs.
// No external dependencies — serves the repo root as-is, matching how
// the app is deployed (a plain static site, no build step).
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 4173;

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Resolves a request URL to an absolute path inside ROOT, or null if the
// request is malformed or attempts to escape ROOT in any way. Returning
// null (rather than throwing) keeps the request handler itself simple and
// exception-free.
function resolveSafePath(reqUrl) {
  const rawPath = reqUrl.split('?')[0]; // query string never reaches the filesystem
  let urlPath;
  try {
    urlPath = decodeURIComponent(rawPath);
  } catch {
    return null; // malformed percent-encoding (e.g. a lone "%")
  }
  if (urlPath.indexOf('\0') !== -1) return null; // reject embedded null bytes

  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  // Reject any literal ".." path segment before it ever reaches path.join,
  // regardless of which separator it arrived with — path.join only
  // normalizes "/"-style traversal on POSIX, so a raw "\\.." segment would
  // otherwise slip through as an unresolved (if inert) oddity. Decoded
  // "%2e%2e" already becomes a literal ".." by this point.
  const segments = urlPath.split(/[/\\]/);
  if (segments.includes('..')) return null;

  const filePath = path.resolve(path.join(ROOT, urlPath));

  // Boundary-correct containment check: a plain `startsWith(ROOT)` would
  // wrongly accept a sibling directory like "ROOT-evil" that merely shares
  // ROOT as a string prefix. Require an exact match or a path separator
  // right after ROOT.
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) return null;

  return filePath;
}

const server = http.createServer((req, res) => {
  // The repo has no favicon.ico (a pre-existing condition — the real Vercel
  // deployment 404s on it identically). Browsers request it automatically
  // regardless of any <link rel="icon">, and a 404 there shows up as a
  // console error in every test, unrelated to anything the app or the test
  // itself does. Silencing it here (test server only) keeps the smoke
  // suite's "no console errors" assertion meaningful for errors the app
  // actually causes, without touching production files or behavior.
  if ((req.url || '').split('?')[0] === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  const filePath = resolveSafePath(req.url || '/');
  if (!filePath) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad request');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Covers "not found" and "is a directory" (EISDIR — no listing is
      // ever generated) alike; never echo err.message or the resolved
      // path back to the client.
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Static server on http://127.0.0.1:${PORT}`);
});
