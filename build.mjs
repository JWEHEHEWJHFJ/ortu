// Jalankan: npm install && npm run build
// Input : src/index.src.html  (file index.html asli kamu)
// Output: dist/index.html + dist/app.<hash>.js (ter-obfuscate)
//         + salinan config.js dan data/ dari root repo
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import JavaScriptObfuscator from 'javascript-obfuscator';

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

const obfuscated = JavaScriptObfuscator.obfuscate(bundle, {
  seed,
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

// 8. Salin file statis yang memang harus publik (dsgan.js, kalgan.js, src/, scripts/ TIDAK ikut)
for (const f of ['config.js', 'data']) {
  if (fs.existsSync(f)) {
    fs.cpSync(f, path.join(OUT, f), {
      recursive: true,
      filter: (src) => path.basename(src) !== '_index.json', // berisi daftar semua NISN & nama
    });
  }
}

console.log(`OK -> ${OUT}/index.html + ${OUT}/${jsName} (${(obfuscated.length / 1024).toFixed(0)} KB)`);
