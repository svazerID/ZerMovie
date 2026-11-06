// ─── ZerMovie service worker ──────────────────────────────────────────────────
// Caches the app shell so the installed PWA still opens offline. Catalog data
// (/api/*) and third-party requests (TMDB posters, player embeds) are never
// intercepted. Bump CACHE whenever SHELL changes; old caches are purged.
const CACHE = 'zermovie-v1';
const SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icon.png',
  '/icons/icon-192.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function store(key, res) {
  if (res.ok) {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(key, copy));
  }
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

  // Pages: network-first so new deploys show up at once, cached shell offline.
  // Every route is the same SPA document (hash routing), so it's stored as '/'.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => store('/', res)).catch(() => caches.match('/')));
    return;
  }

  // Static assets: cache-first, refreshed in the background.
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(res => store(req, res)).catch(() => hit || Response.error());
    return hit || net;
  }));
});
