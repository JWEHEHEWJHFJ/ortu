# Portal Orang Tua — SMAN 5 Pinrang (Cloudflare Pages)

## Struktur

```
src/index.src.html     <- SATU-SATUNYA sumber HTML/CSS/JS. Edit di sini.
build.mjs              <- build: obfuscate -> dist/ (+ _headers, _routes.json, config.js terenkripsi)
functions/_middleware.js <- proteksi di edge Cloudflare (anti-scrape, anti-hotlink, decoy)
config.js              <- gasUrl (teks biasa di repo; di dist otomatis terenkripsi)
domains.txt            <- domain yang boleh menjalankan aplikasi (kunci domain)
dsgan.js, kalgan.js    <- sumber data dari Apps Script (TIDAK ikut ke dist)
scripts/               <- pemecah data + enkripsi (dipakai GitHub Actions)
data/nisn, data/kelas  <- hasil split otomatis (data/nisn terenkripsi)
.github/workflows/split-data.yml
```

Yang ikut dipublikasikan hanya isi `dist/`: `index.html` kecil, `app.<hash>.js`
(ter-obfuscate), `config.js` (terenkripsi), `data/`, `_headers`, `_routes.json`.

## Deploy ke Cloudflare Pages (sekali saja)

1. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pilih repo ini.
2. Isi:
   - Framework preset: **None**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment variable: `NODE_VERSION` = `20`
3. Isi **domains.txt** dengan domain final (mis. `.domainkamu.com` dan `namaproyek.pages.dev`), commit.
   Tanpa ini kunci domain nonaktif (build memberi peringatan).
4. (Opsional) Variable `PROTECT_MODE`: `decoy` (default, kirim data sampah ke scraper),
   `block` (403), atau `off` (matikan proteksi middleware kalau ada masalah).
5. **Settings → Build → Build watch paths** (pengganti `ignoreCommand` Vercel), isi:
   `src/*, build.mjs, package.json, config.js, data/*, functions/*, domains.txt`
6. Push → Cloudflare membangun otomatis. Workflow GitHub Actions tetap memecah data
   saat `dsgan.js`/`kalgan.js` berubah, lalu commit-nya memicu deploy baru.

Deploy manual (opsional): `npm install && npm run deploy`.

## Pengaturan Cloudflare yang disarankan (di dashboard domain)

- **Speed → Optimization**: matikan *Rocket Loader* (bisa merusak script ter-obfuscate).
- **Security → Bots**: aktifkan *Bot Fight Mode*.
- **Scrape Shield**: aktifkan *Hotlink Protection*.
- **Security → WAF → Rate limiting**: batasi mis. 60 request/menit per IP untuk path `/data/*`
  (mencegah menebak NISN massal).
- Pastikan repo GitHub **Private**: `dsgan.js`, `src/index.src.html`, dan `data/nisn/_index.json`
  berisi data/kode mentah.

## Data siswa terenkripsi

`scripts/split-dsgan.js` kini menulis `data/nisn/<nisn>.js` sebagai `window.__SP5P="..."`
(format yang sudah didukung aplikasi). Key diambil dari `_SP5P_KEY` di `src/index.src.html`.
Kalau key diganti, jalankan workflow manual (Actions → Run workflow).
Untuk kembali ke teks biasa: set env `SP5P_ENCRYPT=0` pada langkah split.

## Batas proteksi (jujur)

Browser harus menerima kode agar bisa menjalankannya, jadi siapa pun yang cukup ahli tetap
bisa melihatnya lewat DevTools. Lapisan di sini membuat pencurian jauh lebih sulit:
obfuscation + kunci domain (salinan di domain lain tidak jalan) + middleware (curl/scraper/
hotlink dapat file sampah) + header keamanan + config/data terenkripsi. Header `Sec-Fetch-*`
bisa dipalsukan oleh orang yang paham.
