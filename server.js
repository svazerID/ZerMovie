'use strict';

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleApi } from './api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;

// ─── Static File MIME types ───────────────────────────────────────────────────
const MIME = {
  '.html':'text/html; charset=utf-8',
  '.js':'application/javascript',
  '.css':'text/css',
  '.json':'application/json',
  '.webmanifest':'application/manifest+json',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.svg':'image/svg+xml',
  '.ico':'image/x-icon',
  '.woff2':'font/woff2',
  '.woff':'font/woff',
  '.ttf':'font/ttf',
};

function serveStatic(res, filePath, mime) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, {'Content-Type':'text/plain'});
      res.end('Not Found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': mime,
      // sw.js must always revalidate (incl. through proxies/CDNs) so installed PWAs get updates
      'Cache-Control': path.basename(filePath) === 'sw.js' ? 'no-cache' : 'public, max-age=3600'
    });
    res.end(data);
  });
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsedUrl.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ── API routes ──────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    const r = await handleApi(parsedUrl);
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(await r.text());
    return;
  }

  // ── Static files ───────────────────────────────────────────────────────────
  let filePath = pathname === '/' ? '/index.html' : pathname;
  // security: no ../ traversal
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
  const fullPath = path.join(__dirname, 'public', filePath);
  const ext = path.extname(fullPath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    // SPA fallback → index.html
    const idx = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(idx)) {
      serveStatic(res, idx, 'text/html; charset=utf-8');
    } else {
      res.writeHead(404, {'Content-Type':'text/plain'});
      res.end('Not Found — run `npm run build` or place index.html in public/');
    }
    return;
  }

  serveStatic(res, fullPath, mime);
});

server.listen(PORT, () => {
  console.log(`\n  ZerAnime streaming server`);
  console.log(`  Running at http://localhost:${PORT}\n`);
});
