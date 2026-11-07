// ─── Cloudflare Workers entry ─────────────────────────────────────────────────
// wrangler.jsonc serves public/ as static assets (SPA fallback to index.html)
// and sends only /api/* here, mirroring server.js.
import { handleApi } from './api.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(url, request.method);
    return env.ASSETS.fetch(request);
  }
};
