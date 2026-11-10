// Cloudflare Pages Functions — functions/_middleware.js
// Jalan di edge Cloudflare SEBELUM file dikirim (rute dibatasi lewat dist/_routes.json).
//
// Tujuan: mempersulit pencurian kode/data.
//  - Hanya browser yang memuat halaman DARI domain ini yang boleh mengambil
//    app.<hash>.js, config.js, dan data/*.
//  - curl, wget, scraper, hotlink dari situs lain, atau membuka URL file langsung
//    di address bar -> tidak dapat file asli, melainkan DECOY (sampah acak).
//
// Env var opsional (Cloudflare Pages > Settings > Variables):
//   PROTECT_MODE = decoy (default) | block (403) | off (matikan proteksi)
//
// BATAS JUJUR: header Sec-Fetch-* / Referer bisa dipalsukan oleh orang yang paham,
// dan browser tetap harus menerima kode agar bisa menjalankannya (DevTools/Network
// bisa melihatnya). Ini penghalang berlapis, bukan perlindungan mutlak.

const BAD_UA =
  /(curl|wget|httrack|python|aiohttp|httpx|scrapy|go-http|java\/|libwww|perl|ruby|php\/|node-fetch|axios|undici|headless|phantom|selenium|puppeteer|playwright|crawler|spider|scan|nikto|sqlmap|postman|insomnia|webcopier|offline|teleport|sitesucker)/i;

// path -> sec-fetch-dest yang wajib (script untuk <script src>, empty untuk fetch())
const RULES = [
  { re: /^\/app\.[a-f0-9]+\.js$/, dest: 'script', kind: 'app' },
  { re: /^\/config\.js$/, dest: 'empty', kind: 'cfg' },
  { re: /^\/data\//, dest: 'empty', kind: 'data' },
];

const rand = (n) => {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  let s = '';
  for (const x of a) s += String.fromCharCode(x);
  return btoa(s);
};

function decoy(kind) {
  let body;
  if (kind === 'app') {
    body = `(function(){var _0x${rand(6).replace(/[^a-z0-9]/gi, '')}=["${rand(1800)}"];})();`;
  } else if (kind === 'cfg') {
    body = `window.__CFG="${rand(160)}";`;
  } else {
    body = `window.__SP5P="${rand(4200)}";`;
  }
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

function deny(mode, kind) {
  if (mode === 'block') {
    return new Response('Forbidden', {
      status: 403,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  return decoy(kind);
}

function fromOwnPage(request, url, wantDest) {
  const h = request.headers;
  const site = h.get('sec-fetch-site');
  if (site) {
    // Browser modern: harus permintaan same-origin dengan tujuan yang benar
    return site === 'same-origin' && h.get('sec-fetch-dest') === wantDest;
  }
  // Browser lama tanpa Sec-Fetch-*: wajib Referer/Origin dari domain yang sama
  const ref = h.get('referer') || h.get('origin') || '';
  try {
    return new URL(ref).origin === url.origin;
  } catch (_) {
    return false;
  }
}

export async function onRequest({ request, next, env }) {
  const mode = String((env && env.PROTECT_MODE) || 'decoy').toLowerCase();
  if (mode === 'off') return next();

  const url = new URL(request.url);
  const path = url.pathname;
  const ua = request.headers.get('user-agent') || '';

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  // Halaman utama: tolak alat scraping & UA kosong
  if (path === '/' || path === '/index.html') {
    if (!ua || BAD_UA.test(ua)) {
      return new Response('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } });
    }
    return next();
  }

  const rule = RULES.find((r) => r.re.test(path));
  if (!rule) return next();

  if (!ua || BAD_UA.test(ua) || !fromOwnPage(request, url, rule.dest)) {
    return deny(mode, rule.kind);
  }

  const res = await next();
  const out = new Response(res.body, res);
  out.headers.set('Cross-Origin-Resource-Policy', 'same-origin'); // blokir hotlink lintas situs
  out.headers.set('X-Content-Type-Options', 'nosniff');
  out.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return out;
}
