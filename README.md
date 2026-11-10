# Portal Orang Tua — SMAN 5 Pinrang (Cloudflare Pages)

## Struktur

```
src/index.src.html     <- SATU-SATUNYA sumber HTML/CSS/JS. Edit di sini.
build.mjs              <- build: obfuscate -> dist/ (+ _headers, _routes.json, config.js terenkripsi)
edge/guard.js + worker/index.js <- proteksi di edge Cloudflare (anti-scrape, anti-hotlink, decoy)
wrangler.jsonc         <- konfigurasi deploy (build, assets, rute proteksi)
config.js              <- gasUrl (teks biasa di repo; di dist otomatis terenkripsi)
domains.txt            <- domain yang boleh menjalankan aplikasi (kunci domain)
dsgan.js, kalgan.js    <- sumber data dari Apps Script (TIDAK ikut ke dist)
scripts/               <- pemecah data + enkripsi (dipakai GitHub Actions)
data/nisn, data/kelas  <- hasil split otomatis (data/nisn terenkripsi)
.github/workflows/split-data.yml
```

Yang ikut dipublikasikan hanya isi `dist/`: `index.html` kecil, `app.<hash>.js`
(ter-obfuscate), `config.js` (terenkripsi), `data/`, `_headers`, `_routes.json`.

## Deploy ke Cloudflare (Workers + Static Assets, alur "Workers Builds")

1. Dashboard → **Workers & Pages → Create → Import a repository** → pilih repo ini.
2. **Nama proyek harus sama dengan `"name"` di `wrangler.jsonc`** (ubah salah satunya).
3. Build command boleh kosong (build sudah dijalankan oleh `wrangler.jsonc`), atau isi `npm run build`.
   Deploy command: `npx wrangler deploy` (bawaan).
4. Isi `domains.txt` dengan domain final (mis. `.domainkamu.com` dan `namaproyek.workers.dev`), commit.
   Tanpa ini kunci domain nonaktif (build memberi peringatan).
5. Mode proteksi diatur di `wrangler.jsonc` → `vars.PROTECT_MODE`: `decoy` | `block` | `off`.
6. Pengganti `ignoreCommand` Vercel: **Settings → Build → Build watch paths**:
   `src/*, build.mjs, package.json, config.js, data/*, edge/*, worker/*, wrangler.jsonc, domains.txt`
7. Workflow GitHub Actions tetap memecah data saat `dsgan.js`/`kalgan.js` berubah; commit-nya memicu deploy baru.

Kalau memakai **Cloudflare Pages** (bukan Workers): build command `npm run build`, output `dist`,
folder `functions/` otomatis dipakai.

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
