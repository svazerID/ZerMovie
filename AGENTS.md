# AGENTS.md

ZerMovie — dark-themed movie streaming catalog. Backend proxies the public
Veloflix (`veloflix.my.id`) catalog API and serves a static SPA frontend.

## Run

- `npm start` — run server (default port `8080`, override with `PORT`).
- `npm run dev` — run with `node --watch` (auto-restart on change).
- Frontend is served from `public/` (there is **no build step** — edit
  `public/index.html` directly and reload).
- Root `index.html` is a separate, non-served draft/staging copy; the served
  page lives in `public/index.html`.

## Stack

- Node ≥ 18, ES modules (`"type": "module"`), **zero dependencies** — plain
  `http` server + native `fetch`. Do not add npm packages unless truly needed.
- No TypeScript, no bundler, no tests. Native `import`, native Web APIs.

## Backend (`server.js`)

- A single `http.createServer` handler with two responsibilities:
  1. **API routes** under `/api/`:
     - `/api/feed` — homepage catalog grouped by category (scraped from the
       Veloflix HTML in `engine.getFeed`).
     - `/api/search?q=` — title search via Veloflix API.
     - `/api/detail?type&id[&season&episode]` — metadata + streaming servers.
     - `/api/stream?type&id[&season&episode]` — streaming links only.
     - `/api/proxy/*` — pass-through to Veloflix.
  2. **Static file serving** from `public/` with an SPA fallback to
     `index.html`.
- All responses are run through `clean()` to drop `null`/`''`/empty-array
  fields (`{"key": undefined}` → key omitted).
- API responses are wrapped `{ status, creator: 'Lann', ... }` with
  **Indonesian field names** (`judul`, `tahun`, `jenis`, `daftar_film`,
  `pemain_utama`, `server_streaming`). Keep this naming convention.

### Conventions

- `engine` object in `server.js` owns all Veloflix I/O (search / detail /
  feed / streaming-link builders). It returns raw-ish objects; the route
  handler wraps and renames them for the API.
- Streaming servers are enumerated in `engine.getStreamingLinks` (Vidlink,
  NxSha, ZxcStream, Videasy, AutoEmbed, 2Embed, VidSrc). Adding a source =
  add one map entry, movie and TV variant.
- MDN-style code comments (`// ─── Section ───...`) are the existing style;
  keep header lines for the major blocks, don't add noise elsewhere.
- Node errors are mostly swallowed (`try/catch` returning `null`) and mapped
  to sensible fallbacks/`404` — follow that pattern.

## Frontend (`public/index.html`)

- Single page: all CSS in one `<style>` block (`:root` custom properties for
  the dark theme), vanilla JS in a trailing `<script>` that fetches the API
  and renders with template strings. No framework, no build.
- Popular sections (Latest / Trending / Most Viewed / Top Picks) exist as
  placeholders and currently render a hardcoded `animeData` sample array, not
  live `/api/feed` data.

## External dependencies / stability

- Relies on the upstream Veloflix site and TMDB images staying reachable.
  Scraping (`parseCards`) is coupled to Veloflix HTML structure — changes
  upstream will break `getFeed`. No caching layer; each request hits upstream.
- `veloGet` bails silently on non-2xx and returns `null`; code paths must
  tolerate `null`.
- Domain brands (ZerMovie, svazer) are decoration for a non-official
  catalog; content is from public indices.