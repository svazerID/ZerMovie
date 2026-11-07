// Veloflix engine + /api/* routes, shared by server.js (Node) and worker.js
// (Cloudflare Workers): keep this file to Web APIs only (fetch, URL, Response).

// ─── Veloflix Engine ────────────────────────────────────────────────────────────
const VELO_BASE = 'https://veloflix.my.id';
const VELO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Referer': VELO_BASE + '/'
};

const GENRE_MAP = {
  28:'Action',12:'Adventure',16:'Animation',35:'Comedy',80:'Crime',
  99:'Documentary',18:'Drama',10751:'Family',14:'Fantasy',36:'History',
  27:'Horror',10402:'Music',9648:'Mystery',10749:'Romance',878:'Sci-Fi',
  10770:'TV Movie',53:'Thriller',10752:'War',37:'Western',
  10759:'Action & Adventure',10762:'Kids',10763:'News',10764:'Reality',
  10765:'Sci-Fi & Fantasy',10766:'Soap',10767:'Talk',10768:'War & Politics'
};

function clean(obj) {
  if (Array.isArray(obj)) return obj.map(clean).filter(v => v != null);
  if (obj !== null && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v == null || v === '') continue;
      if (Array.isArray(v) && v.length === 0) continue;
      out[k] = clean(v);
    }
    return out;
  }
  return obj;
}

async function veloGet(endpoint, json = true) {
  const url = endpoint.startsWith('http') ? endpoint : `${VELO_BASE}${endpoint}`;
  try {
    const resp = await fetch(url, { headers: VELO_HEADERS });
    if (resp.ok) return json ? await resp.json() : await resp.text();
  } catch (_) {}
  return null;
}

function parseCards(html) {
  const cards = [];
  const seen = new Set();
  const re = /<a[^>]*href="\/title\/(movie|tv)\/(\d+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const type = m[1];
    const id = parseInt(m[2], 10);
    if (seen.has(id)) continue;
    seen.add(id);
    const inner = m[3];
    const titleM = inner.match(/title="([^"]+)"/) || inner.match(/<p[^>]*class="[^"]*truncate[^"]*"[^>]*>([^<]+)<\/p>/);
    const title = titleM ? titleM[1].replace(/&amp;/g,'&').replace(/&#x27;/g,"'").trim() : '';
    const imgM = inner.match(/srcSet="([^"]+)"/) || inner.match(/src="([^"]+)"/);
    let poster = null;
    if (imgM) {
      const decoded = decodeURIComponent(imgM[1]);
      const tm = decoded.match(/https:\/\/image\.tmdb\.org\/t\/p\/[^\s&]+/);
      poster = tm ? tm[0] : null;
    }
    const ratingM = inner.match(/([0-9.]+)\s*<span class="sr-only">/);
    const yearM = inner.match(/(\d{4})\s*<\/span>/);
    if (id && title) {
      cards.push({
        id, mediaType: type, title,
        year: yearM ? parseInt(yearM[1]) : undefined,
        rating: ratingM ? parseFloat(ratingM[1]) : undefined,
        posterUrl: poster || undefined,
        link_nonton: `${VELO_BASE}/watch/${type}/${id}?play=1`
      });
    }
  }
  return cards;
}

const engine = {
  async getFeed() {
    const html = await veloGet('/', false);
    if (!html) return { total_kategori: 0, total_judul_unik: 0, kategori: [] };
    const sections = html.match(/<section[^>]*>[\s\S]*?<\/section>/g) || [];
    const cats = [];
    const allTitles = new Map();
    for (const sec of sections) {
      const titleM = sec.match(/<h2[^>]*>(.*?)<\/h2>/);
      const ariaM = sec.match(/aria-label="([^"]*)"/);
      const catName = titleM
        ? titleM[1].replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').trim()
        : (ariaM ? ariaM[1] : null);
      if (!catName || catName.includes('Support Channel') || catName.includes('Tersedia')) continue;
      const cards = parseCards(sec);
      if (cards.length) {
        cards.forEach(c => allTitles.set(c.id, c));
        cats.push({ nama_kategori: catName, jumlah_film: cards.length, daftar_film: cards });
      }
    }
    return { total_kategori: cats.length, total_judul_unik: allTitles.size, kategori: cats };
  },

  async search(q) {
    if (!q.trim()) return [];
    const yearM = q.match(/\b(19\d\d|20\d\d)\b/);
    const cleanT = q.replace(/\b(19\d\d|20\d\d)\b/g,'').replace(/[()]/g,'').trim();
    let res = await veloGet(`/api/search?q=${encodeURIComponent(q)}`);
    let list = res?.data || [];
    if (!list.length && cleanT) {
      res = await veloGet(`/api/search?q=${encodeURIComponent(cleanT)}`);
      list = res?.data || [];
    }
    if (!list.length) {
      const stripped = q.replace(/[^a-zA-Z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
      if (stripped && stripped !== cleanT) {
        res = await veloGet(`/api/search?q=${encodeURIComponent(stripped)}`);
        list = res?.data || [];
      }
    }
    if (yearM && list.length) {
      const y = parseInt(yearM[1]);
      list.sort((a,b) => (b.year === y ? 1:0) - (a.year === y ? 1:0));
    }
    return list.map(i => ({
      id_tmdb: i.id,
      jenis: i.mediaType === 'tv' ? 'TV Series' : 'Movie',
      mediaType: i.mediaType,
      judul: i.title,
      tahun: i.year || undefined,
      rating: i.rating ? `${i.rating.toFixed(1)} / 10` : undefined,
      genre: (i.genreIds || []).map(id => GENRE_MAP[id] || `Genre-${id}`),
      poster_url: i.posterUrl || undefined,
      sinopsis: i.overview ? (i.overview.length > 200 ? i.overview.slice(0,200)+'…' : i.overview) : 'Belum ada sinopsis.'
    }));
  },

  async getDetail(type, id) {
    const res = await veloGet(`/api/title/${type}/${id}`);
    const d = res?.data || {};
    if (!d.title) return {};
    const out = {
      id_tmdb: d.id,
      judul: d.title,
      jenis: d.mediaType === 'tv' ? 'TV Series' : 'Movie',
      tahun: d.year || undefined,
      rating: d.rating ? `${d.rating.toFixed(1)} / 10` : undefined,
      genre: d.genres || [],
      tanggal_rilis: d.releaseDate || undefined,
      negara_asal: d.originCountry || undefined,
      bahasa_asli: d.originalLanguage ? d.originalLanguage.toUpperCase() : undefined,
      imdb_id: d.imdbId || undefined,
      trailer_youtube: d.trailerYoutubeId ? `https://youtu.be/${d.trailerYoutubeId}` : undefined,
      poster_url: d.posterUrl || undefined,
      backdrop_hd: d.backdropUrl || undefined,
      sinopsis: d.overview || 'Belum ada sinopsis.'
    };
    if (Array.isArray(d.cast) && d.cast.length) {
      out.pemain_utama = d.cast.slice(0,8).map(c => ({
        nama: c.name, peran: c.character || 'Pemeran',
        foto_profil: c.profileUrl || undefined
      }));
    }
    if (d.mediaType === 'tv' && Array.isArray(d.seasons) && d.seasons.length) {
      out.daftar_musim = d.seasons.map(s => ({
        season_ke: s.seasonNumber,
        nama_season: s.name,
        jumlah_episode: s.episodeCount,
        tanggal_rilis: s.airDate || undefined,
        poster: s.posterUrl || undefined
      }));
    }
    if (Array.isArray(d.recommendations) && d.recommendations.length) {
      out.film_serupa = d.recommendations.slice(0,5).map(r => ({
        id_tmdb: r.id, judul: r.title,
        jenis: r.mediaType === 'tv' ? 'TV Series' : 'Movie',
        tahun: r.year || undefined,
        rating: r.rating ? `${r.rating.toFixed(1)} / 10` : undefined,
        poster_url: r.posterUrl || undefined
      }));
    }
    return out;
  },

  getStreamingLinks(type, id, season = 1, episode = 1) {
    const m = type === 'movie';
    return clean({
      [m ? 'movie' : 'tv']: type,
      tmdb_id: id,
      season, episode,
      server_streaming: m ? {
        'Vidlink (Fast Direct 1080p)': `https://vidlink.pro/movie/${id}?primaryColor=e50914&autoplay=true`,
        'NxSha AWS (Multi-Audio & Sub Indo)': `https://web.nxsha.app/embed/movie/${id}?server=AwsPly-[Multi-Lang]`,
        'ZxcStream (Dubbing & Sub Indo)': `https://zxcstream.xyz/player/movie/${id}?dubLang=id`,
        'Videasy (4K Ultra HD)': `https://player.videasy.net/movie/${id}`,
        'AutoEmbed (Multi-Source)': `https://player.autoembed.co/embed/movie/${id}`,
        '2Embed (Cloud Stream)': `https://2embed.cc/embed/${id}`,
        'VidSrc SBS Pro': `https://vidsrc.sbs/embed/movie/${id}?color=e50914&sub=id`
      } : {
        'Vidlink (Fast Direct 1080p)': `https://vidlink.pro/tv/${id}/${season}/${episode}?primaryColor=e50914&autoplay=true`,
        'NxSha AWS (Multi-Audio & Sub Indo)': `https://web.nxsha.app/embed/tv/${id}/${season}/${episode}?server=AwsPly-[Multi-Lang]`,
        'ZxcStream (Dubbing & Sub Indo)': `https://zxcstream.xyz/player/tv/${id}/${season}/${episode}/en?dubLang=id`,
        'Videasy (4K Ultra HD)': `https://player.videasy.net/tv/${id}/${season}/${episode}`,
        'AutoEmbed (Multi-Source)': `https://player.autoembed.co/embed/tv/${id}/${season}/${episode}`,
        '2Embed (Cloud Stream)': `https://2embed.cc/embedtv/${id}&s=${season}&e=${episode}`,
        'VidSrc SBS Pro': `https://vidsrc.sbs/embed/tv/${id}/${season}/${episode}?color=e50914&sub=id`
      }
    });
  }
};

// ─── API routes ───────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
  'Access-Control-Expose-Headers': 'Content-Type'
};

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

export async function handleApi(url, method = 'GET') {
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const pathname = url.pathname;
  const qs = Object.fromEntries(url.searchParams);

  if (pathname === '/api/feed') {
    const data = await engine.getFeed();
    return json(200, clean({ status: 200, creator: 'Lann', ...data }));
  }

  if (pathname === '/api/search') {
    const q = qs.q || '';
    if (!q) return json(400, { status: 400, error: 'q parameter required' });
    const results = await engine.search(q);
    return json(200, clean({ status: 200, creator: 'Lann', kata_kunci: q, total_ditemukan: results.length, hasil: results }));
  }

  if (pathname === '/api/detail') {
    const { type = 'movie', id, season = 1, episode = 1 } = qs;
    if (!id) return json(400, { status: 400, error: 'id parameter required' });
    const detail = await engine.getDetail(type, parseInt(id));
    const servers = engine.getStreamingLinks(type, parseInt(id), parseInt(season), parseInt(episode));
    return json(200, clean({ status: 200, creator: 'Lann', detail, server_streaming: servers }));
  }

  if (pathname === '/api/stream') {
    const { type = 'movie', id, season = 1, episode = 1 } = qs;
    if (!id) return json(400, { status: 400, error: 'id parameter required' });
    const links = engine.getStreamingLinks(type, parseInt(id), parseInt(season), parseInt(episode));
    return json(200, clean({ status: 200, creator: 'Lann', ...links }));
  }

  // proxy Veloflix api
  const veloPath = pathname.replace('/api/proxy', '');
  const proxied = await veloGet(veloPath + (url.search || ''));
  return json(200, clean(proxied));
}
