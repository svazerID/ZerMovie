# ZerMovie

Dark movie/anime streaming catalog (formerly ZerAnime). A zero-dependency Node
backend proxies the public [Veloflix](https://veloflix.my.id) catalog API and
serves a single-page vanilla-JS frontend with a native streaming player.

## Features

- **Homepage catalog** grouped by category via `/api/feed`.
- **Hero spotlight carousel** — up to 5 titles from the Top Trending Movies
  category, with ken-burns zoom, auto-advance, and clickable thumbnails.
- **Search** — live suggestions, search history (localStorage), and
  All / Movie / TV filter tabs.
- **Detail pages** — synopsis, cast, seasons, similar titles, and streaming
  servers.
- **Watch player** — embedded player with selectable server tabs (one list, no
  duplicates); iframes use `allowfullscreen` and **no** `sandbox` attribute so
  playback isn't blocked.
- **Responsive** — mobile-first, hamburger sidebar and bottom-nav on screens
  ≤768px.
- **PWA / Android app** — installable from Chrome on Android (web app
  manifest, maskable icons, standalone display). A service worker caches the
  app shell so the installed app still opens offline; an install banner and
  the sidebar's "Install Aplikasi" item trigger the install prompt.
- Branding toggle: user-facing copy says "movie", internal hash routes stay
  `#!/anime/...`.

## Requirements

- Node ≥ 18, with native `fetch` (no `node-fetch`).
- No npm packages — plain `http` server, ES modules.

## Getting started

```bash
npm start          # run on http://localhost:8080
npm run dev        # run with node --watch (auto-restart on change)
```

Override the port with `PORT`:

```bash
PORT=3000 npm start
```

There is **no build step** — edit `public/index.html` directly and reload.

## Project structure

```
├── server.js                    # HTTP server: /api/* routes + static serving
├── public/index.html            # SPA frontend (all CSS + JS inline, no build)
├── public/manifest.webmanifest  # PWA manifest (name, colors, icons)
├── public/sw.js                 # Service worker (offline app shell)
├── public/icons/                # PWA icons (192px + maskable 192/512px)
└── index.html                   # Non-served draft/staging copy
```

## Android app (PWA)

1. Deploy behind **HTTPS** (required for installing; `http://localhost` works
   for local testing) and open the site in Chrome on Android.
2. Tap **Install** on the banner, **Install Aplikasi** in the sidebar, or
   Chrome menu ⋮ → **Install app**.
3. ZerMovie is added to the home screen / app drawer and opens full screen.

The service worker only caches same-origin static files (pages are
network-first); `/api/*` and cross-origin requests always go to the network.
Bump `CACHE` in `public/sw.js` when the precached `SHELL` list changes.

## API routes

| Route | Description |
| --- | --- |
| `/api/feed` | Homepage catalog grouped by category |
| `/api/search?q=` | Title search via Veloflix API |
| `/api/detail?type&id[&season&episode]` | Metadata + streaming servers |
| `/api/stream?type&id[&season&episode]` | Streaming links only |
| `/api/proxy/*` | Pass-through to Veloflix |

Responses are cleaned (empty/null fields dropped) and wrapped as
`{ status, creator: 'Lann', ... }` with Indonesian field names
(`judul`, `tahun`, `jenis`, `daftar_film`, `pemain_utama`, `server_streaming`).

## Dependencies / stability

- Relies on the upstream Veloflix site and TMDB images staying reachable.
  Scraping is coupled to Veloflix HTML structure — upstream changes can break
  `/api/feed`. There is no caching layer; each request hits upstream.
- `veloGet` bails silently on non-2xx and returns `null`; code paths tolerate it.

Domain brand (ZerMovie/svazer) is decoration for a non-official catalog;
content is from public indices.

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Run the server (port `8080`, override with `PORT`) |
| `npm run dev` | Run with auto-restart on file change |