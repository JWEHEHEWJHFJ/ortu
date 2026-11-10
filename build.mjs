// Jalankan: npm install && npm run build   (dipakai Cloudflare Pages: output = dist)
// Input : src/index.src.html  (SATU-SATUNYA file sumber HTML/JS/CSS)
// Output: dist/index.html + dist/app.<hash>.js (ter-obfuscate)
//         + dist/config.js (TERENKRIPSI) + dist/data/ (tanpa _index.json)
//         + dist/_headers + dist/_routes.json (konfigurasi Cloudflare Pages)
// Env opsional:
//   ALLOWED_DOMAINS = ".domainkamu.com,projek.pages.dev"  -> kode hanya jalan di domain ini
//                     (disalin ke domain lain = tidak berfungsi). Awalan titik = termasuk subdomain.
//   Alternatif tanpa env: isi file domains.txt (satu domain per baris, # = komentar).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import JavaScriptObfuscator from 'javascript-obfuscator';

const require = createRequire(import.meta.url);
const { readKey, encrypt } = require('./scripts/sp5p-crypto.cjs');

const SRC = 'src/index.src.html';
const OUT = 'dist';
const html = fs.readFileSync(SRC, 'utf8');

// 1. Ambil semua <script> inline
const inline = [];
for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
  inline.push({ code: m[1], index: m.index });
}
const security = inline.find(s => s.code.includes('_SP5P_KEY'));
const app = inline.find(s => s.code.includes('createApp('));
if (!security || !app) throw new Error('Script security/app tidak ditemukan di ' + SRC);

// 2. Ambil CSS (semua <style>, urutan dipertahankan) lalu minify ringan
const css = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)]
  .map(m => m[1]).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ')
  .replace(/\s*([{};,])\s*/g, '$1')
  .trim();

// 3. Ambil template Vue di dalam <div id="app"> ... </div>
const open = '<div id="app">';
const tplStart = html.indexOf(open) + open.length;
const tplEnd = html.lastIndexOf('</div>', app.index);
const template = html.slice(tplStart, tplEnd);

// 4. Gabungkan jadi satu bundle. Template & CSS ikut jadi string ter-obfuscate,
//    jadi tidak ada lagi markup/directive Vue mentah di HTML.
const bundle = `
;(function(){${security.code}})();
;(function(){
  var css=${JSON.stringify(css)};
  try{var sh=new CSSStyleSheet();sh.replaceSync(css);document.adoptedStyleSheets=[sh];}
  catch(e){var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);}
  document.getElementById('app').innerHTML=${JSON.stringify(template)};
})();
;(function(){${app.code}})();
`;

// 5. Obfuscate
// Seed diturunkan dari isi sumber: kalau kode tidak berubah (misal deploy karena data siswa
// berubah), hasil obfuscate identik -> nama file sama -> browser 1000 siswa tidak perlu
// mengunduh ulang bundle. Tanpa seed, setiap build menghasilkan file berbeda.
const seed = (parseInt(crypto.createHash('sha256').update(bundle).digest('hex').slice(0, 8), 16) % 2147483646) + 1;

// Kunci domain: kalau ALLOWED_DOMAINS diisi, bundle menolak jalan di domain lain.
const fromFile = fs.existsSync('domains.txt')
  ? fs.readFileSync('domains.txt', 'utf8').split('\n').map(l => l.replace(/#.*/, '').trim()).filter(Boolean)
  : [];
const allowedDomains = [
  ...(process.env.ALLOWED_DOMAINS || '').split(','),
  ...fromFile,
].map(s => s.trim()).filter(Boolean);
if (!allowedDomains.length) {
  console.warn('PERINGATAN: ALLOWED_DOMAINS belum diisi -> kunci domain NONAKTIF. Isi domains.txt atau env ALLOWED_DOMAINS.');
}

const obfuscated = JavaScriptObfuscator.obfuscate(bundle, {
  seed,
  ...(allowedDomains.length ? { domainLock: allowedDomains, domainLockRedirectUrl: 'about:blank' } : {}),
  target: 'browser',
  compact: true,
  simplify: true,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,          // window._sp5p_* harus tetap
  transformObjectKeys: false,    // key hasil return setup() harus cocok dengan template
  stringArray: true,
  stringArrayThreshold: 1,
  stringArrayEncoding: ['base64'],
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersType: 'function',
  splitStrings: false,           // template sangat panjang, jangan dipecah
  numbersToExpressions: true,
  disableConsoleOutput: true,
  selfDefending: false,
}).getObfuscatedCode();

// 6. Tulis file ber-hash (cache 1 tahun aman karena nama berubah tiap isi berubah)
const hash = crypto.createHash('sha256').update(obfuscated).digest('hex').slice(0, 10);
const jsName = `app.${hash}.js`;
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, jsName), obfuscated);

// 7. index.html kecil: hanya <head> (font + library CDN) dan satu loader
const head = [
  ...(html.match(/<link[^>]+>/g) || []),
  ...(html.match(/<script src="[^"]+"><\/script>/g) || []),
].join('\n');
const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [, 'Portal Akademik'])[1];

const page = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex, nofollow, noarchive" />
<title>${title}</title>
${head}
<style>html,body{margin:0;background:#0a1628}</style>
</head>
<body>
<div id="app"></div>
<script src="/${jsName}" onload="this.remove()"></script>
</body>
</html>
`;
fs.writeFileSync(path.join(OUT, 'index.html'), page);

// 8. Salin file statis yang memang harus publik (dsgan.js, kalgan.js, src/, scripts/, functions/ TIDAK ikut)
if (fs.existsSync('data')) {
  fs.cpSync('data', path.join(OUT, 'data'), {
    recursive: true,
    filter: (src) => path.basename(src) !== '_index.json', // berisi daftar semua NISN & nama
  });
}

// config.js: ditulis TERENKRIPSI ke dist (format window.__CFG="..." yang dibaca _sp5p_loadConfig).
// File config.js di root repo tetap teks biasa agar mudah kamu edit.
if (fs.existsSync('config.js')) {
  const src = fs.readFileSync('config.js', 'utf8');
  // new Function tidak punya "window"; sediakan lewat parameter:
  const cfgObj = (new Function('window', src + '; return window.CONFIG;'))({});
  fs.writeFileSync(
    path.join(OUT, 'config.js'),
    `window.__CFG=${JSON.stringify(encrypt(JSON.stringify(cfgObj), readKey(SRC)))};\n`
  );
}

// 9. Konfigurasi Cloudflare Pages
// _headers : header keamanan + cache (berlaku untuk file statis)
fs.writeFileSync(path.join(OUT, '_headers'), `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Strict-Transport-Security: max-age=31536000
  X-Robots-Tag: noindex, nofollow, noarchive, nosnippet
  Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; object-src 'none'

/
  Cache-Control: public, max-age=300
/index.html
  Cache-Control: public, max-age=300
/${jsName}
  Cache-Control: public, max-age=31536000, immutable
/config.js
  Cache-Control: public, max-age=300
/data/*
  Cache-Control: public, max-age=300
`);

// _routes.json : hanya rute ini yang melewati functions/_middleware.js (hemat kuota Functions)
fs.writeFileSync(path.join(OUT, '_routes.json'), JSON.stringify({
  version: 1,
  include: ['/', '/index.html', '/app.*', '/config.js', '/data/*'],
  exclude: [],
}, null, 2));

console.log(`OK -> ${OUT}/index.html + ${OUT}/${jsName} (${(obfuscated.length / 1024).toFixed(0)} KB)`);
