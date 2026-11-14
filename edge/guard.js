// edge/guard.js — logika yang berjalan di edge Cloudflare.
// Dipakai oleh worker/index.js (Workers + Static Assets) dan functions/_middleware.js (Pages).
//
// HEMAT REQUEST: Worker HANYA dipanggil untuk CFG_PATH (lihat edge/paths.mjs).
// index.html, app.<hash>.js, data/*, favicon, dll. disajikan sebagai static asset
// (gratis & tidak dihitung di "Requests today"). Jadi 1 kali buka aplikasi = 1 request.
//
// Proteksi di CFG_PATH: hanya fetch() dari halaman di domain ini yang mendapat
// config asli. curl/scraper/hotlink/buka langsung di address bar -> DECOY (sampah acak)
// atau 403, tergantung PROTECT_MODE.
//
// Env var opsional (vars di wrangler.jsonc atau dashboard):
//   PROTECT_MODE = decoy (default) | block (403) | off (matikan proteksi)
//
// BATAS JUJUR: header Sec-Fetch-* / Referer bisa dipalsukan oleh orang yang paham,
// dan browser tetap harus menerima kode agar bisa menjalankannya. Ini penghalang
// berlapis, bukan perlindungan mutlak.
import { CFG_PATH } from './paths.mjs';
// Dibuat otomatis oleh build.mjs dari config.js (sudah terenkripsi). Tidak di-commit.
import CFG_BODY from './config.gen.js';

const BAD_UA =
  /(curl|wget|httrack|python|aiohttp|httpx|scrapy|go-http|java\/|libwww|perl|ruby|php\/|node-fetch|axios|undici|headless|phantom|selenium|puppeteer|playwright|crawler|spider|scan|nikto|sqlmap|postman|insomnia|webcopier|offline|teleport|sitesucker)/i;

const NO_STORE = 'no-store, max-age=0';

export const isConfigPath = (pathname) => pathname === CFG_PATH;

const rand = (n) => {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  let s = '';
  for (const x of a) s += String.fromCharCode(x);
  return btoa(s);
};

function jsResponse(body, request, status = 200) {
  return new Response(request.method === 'HEAD' ? null : body, {
    status,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      // no-store: setiap kali halaman dibuka, config diminta ulang -> tepat 1 hitungan per buka
      'Cache-Control': NO_STORE,
      'Cross-Origin-Resource-Policy': 'same-origin', // blokir hotlink lintas situs
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

function deny(mode, request) {
  if (mode === 'block') {
    return new Response('Forbidden', {
      status: 403,
      headers: { 'Cache-Control': NO_STORE, 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  // decoy: bentuknya mirip config asli, isinya acak
  return jsResponse(`window.__CFG="${rand(160)}";\n`, request);
}

// Harus fetch() same-origin dari halaman ini (Sec-Fetch-Dest: empty).
function fromOwnPage(request, url) {
  const h = request.headers;
  const site = h.get('sec-fetch-site');
  if (site) {
    return site === 'same-origin' && h.get('sec-fetch-dest') === 'empty';
  }
  // Browser lama tanpa Sec-Fetch-*: wajib Referer/Origin dari domain yang sama
  const ref = h.get('referer') || h.get('origin') || '';
  try {
    return new URL(ref).origin === url.origin;
  } catch (_) {
    return false;
  }
}

export function serveConfig(request, env) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const mode = String((env && env.PROTECT_MODE) || 'decoy').toLowerCase();
  if (mode !== 'off') {
    const url = new URL(request.url);
    const ua = request.headers.get('user-agent') || '';
    if (!ua || BAD_UA.test(ua) || !fromOwnPage(request, url)) return deny(mode, request);
  }
  if (!CFG_BODY) return new Response('Not Found', { status: 404, headers: { 'Cache-Control': NO_STORE } });
  return jsResponse(CFG_BODY, request);
}

// Untuk path yang tidak ada di dist/ dan bukan navigasi browser (biasanya bot/scanner).
// Dijawab secepat mungkin tanpa membaca apa pun.
export function notFound() {
  return new Response('Not Found', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
