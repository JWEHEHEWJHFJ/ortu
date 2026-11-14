# Portal Orang Tua — SMAN 5 Pinrang (Cloudflare)

> **Versi hemat request.** Sekarang **1 kali aplikasi dibuka = 1 hitungan** di
> *Workers & Pages → Requests today*. Login, salah password, logout, hapus data,
> favicon, bot yang mampir, dan tab yang tidak dilihat **tidak lagi menambah hitungan**.

---

## 1. Hasil (diukur, bukan perkiraan)

Diuji di `wrangler dev` (lokal) dengan Google Chrome: buka aplikasi lalu login sekali.

| Permintaan saat 1 orang membuka & login | Versi lama | Versi baru |
|---|---|---|
| `/` (halaman) | Worker ✔ dihitung | static, gratis |
| `/app.<hash>.js` | Worker ✔ dihitung | static, gratis |
| `/config.js` | Worker ✔ dihitung | **dihapus** (diganti `/sp5p-cfg.js`) |
| `/sp5p-cfg.js` (config) | — | **Worker ✔ dihitung (satu-satunya)** |
| `/favicon.ico` (otomatis oleh browser) | file tidak ada → Worker ✔ dihitung | static, gratis |
| `/data/nisn/...` | Worker ✔ dihitung **2x** | static, gratis, 1x |
| `/data/kelas/...` | Worker ✔ dihitung **2x** | static, gratis, 1x |
| **Total di "Requests today"** | **8** | **1** |

Angka 8 itu persis sama dengan screenshot dashboard (`8 / 100,000`), artinya hari itu
kemungkinan besar hanya **1 orang** yang membuka dan login satu kali.

Skenario lain yang juga diuji pada versi baru:

| Skenario | Hitungan |
|---|---|
| Buka → salah password → login → logout → hapus data → login lagi (satu tab) | 1 |
| Reload / buka ulang halaman | +1 (memang dihitung sebagai "membuka") |
| Tab dibuka di latar belakang dan belum dilihat | 0, baru +1 saat tab dilihat |
| Layar kunci DevTools selesai menghitung mundur | 0 (tidak reload otomatis lagi) |
| Bot/curl ke `/`, `/favicon.ico`, `/robots.txt`, `/wp-login.php`, `/.env`, path asal-asalan | 0 |
| curl langsung ke `/sp5p-cfg.js` | 1 (dapat config palsu/decoy) |

---

## 2. Kenapa dulu dihitung berkali-kali & muncul padahal tidak ada yang membuka

1. **5 jenis path dipaksa lewat Worker** (`run_worker_first: ["/", "/index.html", "/app.*", "/config.js", "/data/*"]`).
   Setiap file yang lewat Worker = 1 hitungan. Static asset yang **tidak** lewat Worker gratis dan tidak dihitung.
2. **Path yang tidak ada jatuh ke Worker.** Tanpa `not_found_handling`, semua permintaan ke file yang
   tidak ada (contoh: `/favicon.ico` yang otomatis diminta browser, atau bot pemindai `/wp-login.php`,
   `/.env`, `/admin`) menjalankan Worker → dihitung. **Ini sumber utama hitungan "hantu"** saat tidak ada yang membuka.
3. **Login terpanggil 2x.** Menekan Enter memicu submit form (klik tombol) **dan** `@keyup.enter`,
   sehingga data siswa & kalender masing-masing diunduh 2x (4 hitungan, seharusnya 2).
4. **Logout / hapus data meminta `config.js` lagi** (+1 setiap kali).
5. **Layar kunci reload otomatis** setelah 5 menit, walaupun tab sedang tidak dilihat siapa pun (+1).
6. **Prerender & tab latar.** Chrome bisa memuat halaman diam-diam (prerender saat mengetik alamat,
   tab yang dipulihkan) → config ikut diminta.
7. **"Today" bukan tengah malam WITA.** Hitungan direset **00.00 UTC = pukul 08.00 WITA**.
   Jadi pukul 05.00 pagi, "today" masih memuat pemakaian sejak pukul 08.00 kemarin (termasuk tadi malam).
8. **Hitungan per akun, bukan per proyek.** "Requests today" adalah total **semua** Worker
   dan Pages Functions di akun Cloudflare yang sama. Kalau ada proyek lain di akun ini, hitungannya ikut tercampur.
   Untuk melihat angka proyek ini saja: buka proyek **ortu → Metrics**.

---

## 3. Yang DIHAPUS

| Dihapus | Alasan |
|---|---|
| `"/"`, `"/index.html"`, `"/app.*"`, `"/config.js"`, `"/data/*"` dari `run_worker_first` (`wrangler.jsonc`) | Masing-masing memakan 1 request Worker setiap halaman dibuka/login. |
| File `dist/config.js` (config publik) | Diganti endpoint Worker `/sp5p-cfg.js`. Config tidak lagi berupa file static. |
| Proteksi decoy/UA untuk `app.<hash>.js` dan `data/*` di `edge/guard.js` | Pemeriksaan ini hanya bisa jalan kalau Worker dipanggil (= dihitung). Penggantinya lihat bagian 6. |
| `binding: "ASSETS"` di `wrangler.jsonc` | Worker tidak lagi membaca file static. |
| Nama file data `data/nisn/<NISN>.js` (690 file) | Diganti `data/nisn/<hash>.js` (isi terenkripsinya sama persis, hanya namanya). |
| Permintaan config ulang saat **logout** dan **hapus data** (`src/index.src.html`) | Config cukup dimuat 1x per halaman dibuka. |
| `location.reload()` otomatis di layar kunci DevTools | Diganti tombol **"Buka kembali"**. |
| `window.CONFIG` (config di objek global) dan fallback config teks biasa | Config sekarang disimpan di closure, tidak bisa dibaca lewat `window`. |
| `/config.js` di `_headers`; isi lama `_routes.json` | Tidak dipakai lagi. |

## 4. Yang DITAMBAHKAN / DIUBAH

**Cloudflare / Worker**
- `wrangler.jsonc`
  - `run_worker_first: ["/sp5p-cfg.js"]` → satu-satunya path yang menjalankan Worker.
  - `not_found_handling: "404-page"` → path yang tidak ada dijawab `404.html` **tanpa** menjalankan Worker.
  - `compatibility_date` → `2025-04-01` (navigasi ke path salah tidak memanggil Worker).
- `edge/paths.mjs` *(baru)* — konstanta `CFG_PATH = "/sp5p-cfg.js"`.
- `edge/guard.js` — sekarang hanya: `serveConfig()` (cek UA + `Sec-Fetch-*`/Referer, lalu kirim config
  terenkripsi atau decoy, `Cache-Control: no-store`) dan `notFound()`.
- `worker/index.js` — `/sp5p-cfg.js` → `serveConfig`, selain itu → 404 cepat.
- `functions/_middleware.js` (kalau deploy via Pages) — hanya menangani `/sp5p-cfg.js`, sisanya `next()`.

**Build (`build.mjs`)**
- Config terenkripsi ditulis ke `edge/config.gen.js` (ditanam ke Worker), bukan ke `dist/`.
- Menyalin folder `public/` ke `dist/`.
- `_headers`: `index.html` jadi `no-cache` (selalu cek versi terbaru setelah deploy, balasan 304 gratis);
  cache untuk favicon, ikon, robots.txt; `Cross-Origin-Resource-Policy: same-origin` untuk `/data/*`.
- `_routes.json` (Pages): `include` hanya `/sp5p-cfg.js`.
- `dist/.assetsignore`: `_routes.json` tidak diunggah sebagai file publik di Workers.
- `<link rel="icon">` dan `<link rel="apple-touch-icon">` di `index.html`.
- Pemeriksaan otomatis: build gagal kalau path config di `src/index.src.html`, `edge/paths.mjs`,
  dan `wrangler.jsonc` tidak sama.

**Folder `public/`** *(baru)* — `favicon.ico`, `apple-touch-icon.png`, `apple-touch-icon-precomposed.png`,
`robots.txt` (`Disallow: /`), `404.html`. Browser dan crawler meminta file-file ini secara otomatis;
dulu karena tidak ada, permintaannya jatuh ke Worker dan ikut dihitung.

**Aplikasi (`src/index.src.html`)**
- `_SP5P_CFG_PATH = "/sp5p-cfg.js"`.
- Config dimuat **sekali** per halaman (`cache: "no-store"`), **baru setelah halaman benar-benar terlihat**
  (bukan prerender, bukan tab latar). Kalau pemuatan pertama gagal, dicoba ulang maksimal 1x saat ganti password.
- `window._sp5p_getConfig()` dipakai fitur ganti password untuk mengambil `gasUrl`.
- `_sp5p_fileId(nisn)` → nama file data = SHA-256(key + `|nisn|` + NISN), 32 karakter hex.
- Pencegah login ganda (Enter tidak lagi memicu 2x unduh data).
- Layar kunci: tombol **"Buka kembali"** menggantikan reload otomatis.
- Path data jadi absolut (`/data/nisn/...`, `/data/kelas/...`).

**Data & GitHub Actions**
- `scripts/sp5p-crypto.cjs` — fungsi baru `fileId()` (sama persis dengan `_sp5p_fileId` di aplikasi).
- `scripts/split-dsgan.js`
  - Menulis `data/nisn/<hash>.js`.
  - Menghapus file data lama hasil split (nama NISN mentah, siswa yang sudah keluar) sebelum menulis ulang.
    Hanya file yang isinya memang hasil split yang dihapus.
  - **Perbaikan bug:** siswa yang ada di GANJIL **dan** GENAP dulu kehilangan data GANJIL (file tertimpa).
    Sekarang kedua semester digabung dalam satu file.
  - `_index.json` kini juga mencatat nama file tiap NISN (untuk admin; tidak ikut ke `dist`).
- `.github/workflows/split-data.yml` — juga berjalan saat `scripts/**` atau `src/index.src.html` berubah;
  `git add -A` agar file lama yang dihapus ikut terhapus di repo.
- `data/nisn/` — 690 file sudah dibuat ulang dengan nama baru.

**Lain-lain**
- `.gitignore` *(baru)* — `node_modules/`, `dist/`, `.wrangler/`, `edge/config.gen.js`.

---

## 5. Struktur

```
src/index.src.html        <- SATU-SATUNYA sumber HTML/CSS/JS. Edit di sini.
build.mjs                 <- build: obfuscate -> dist/ + edge/config.gen.js
public/                   <- favicon, apple-touch-icon, robots.txt, 404.html (disalin ke dist/)
edge/paths.mjs            <- CFG_PATH (satu-satunya path Worker)
edge/guard.js             <- logika Worker: kirim config / decoy / 404
edge/config.gen.js        <- dibuat otomatis saat build (JANGAN di-commit)
worker/index.js           <- entry Worker (Workers + Static Assets)
functions/_middleware.js  <- entry Function (kalau deploy via Cloudflare Pages)
wrangler.jsonc            <- konfigurasi deploy
config.js                 <- gasUrl (teks biasa di repo; di Worker otomatis terenkripsi)
domains.txt               <- domain yang boleh menjalankan aplikasi (kunci domain)
dsgan.js, kalgan.js       <- sumber data dari Apps Script (TIDAK ikut ke dist)
scripts/                  <- pemecah data + enkripsi (dipakai GitHub Actions)
data/nisn, data/kelas     <- hasil split otomatis (data/nisn terenkripsi, nama file ter-hash)
.github/workflows/split-data.yml
```

Yang dipublikasikan sebagai static asset hanya isi `dist/`: `index.html`, `app.<hash>.js`
(ter-obfuscate), `data/` (tanpa `_index.json`), isi `public/`, `_headers`.
Config **tidak** ada di `dist/`; hanya Worker yang menyajikannya di `/sp5p-cfg.js`.

---

## 6. Memasang perubahan ini ke repo GitHub

1. Ganti isi repo dengan isi zip ini (semua file, termasuk folder `public/`, `edge/paths.mjs`, `.gitignore`).
2. **Hapus file lama `data/nisn/<NISN>.js`** (nama berupa angka). Cara termudah: hapus seluruh folder
   `data/nisn`, lalu unggah folder `data/nisn` dari zip ini.
   - Kalau lupa, tidak apa-apa: workflow **Split Data** otomatis berjalan (karena `scripts/` berubah),
     membuat ulang data dengan nama baru, dan menghapus file lama. Selama ±1–2 menit sebelum workflow
     selesai, login bisa gagal "NISN tidak ditemukan".
3. Jangan commit folder `dist/` dan file `edge/config.gen.js` (sudah di `.gitignore`).
4. Setelah deploy selesai, buka aplikasi satu kali lalu cek **Requests today** naik **1**.

## 7. Deploy ke Cloudflare (Workers + Static Assets, alur "Workers Builds")

1. Dashboard → **Workers & Pages → Create → Import a repository** → pilih repo ini.
2. **Nama proyek harus sama dengan `"name"` di `wrangler.jsonc`** (ubah salah satunya).
3. Build command boleh kosong (build sudah dijalankan oleh `wrangler.jsonc`), atau isi `npm run build`.
   Deploy command: `npx wrangler deploy` (bawaan).
4. Isi `domains.txt` dengan domain final (mis. `ortu.namaakun.workers.dev`, `.domainkamu.com`), commit.
   Tanpa ini kunci domain nonaktif (build memberi peringatan).
5. Mode proteksi config diatur di `wrangler.jsonc` → `vars.PROTECT_MODE`: `decoy` | `block` | `off`.
6. **Settings → Build → Build watch paths**:
   `src/*, build.mjs, package.json, config.js, data/*, edge/*, worker/*, functions/*, public/*, scripts/*, wrangler.jsonc, domains.txt`
7. Workflow GitHub Actions memecah data saat `dsgan.js`/`kalgan.js`/`scripts/` berubah; commit-nya memicu deploy baru.
   (Build dan GitHub Actions **tidak** memakai kuota Requests today.)

Kalau memakai **Cloudflare Pages** (bukan Workers): build command `npm run build`, output `dist`,
folder `functions/` otomatis dipakai. `_routes.json` membatasi Function hanya ke `/sp5p-cfg.js`.

⚠️ **Jangan menambah path lain ke `run_worker_first`.** Setiap path yang ditambahkan akan kembali
dihitung setiap kali halaman dibuka.

## 8. Cara mengecek

- Dashboard → **Workers & Pages → ortu → Metrics**: hanya proyek ini.
  *Requests today* di halaman Overview = total seluruh akun.
- Ingat: hitungan direset pukul **08.00 WITA** (00.00 UTC).
- Yang **masih** menambah hitungan (memang disengaja / tidak bisa dicegah):
  - setiap kali halaman dibuka atau di-reload: +1;
  - siapa pun (orang/bot) yang langsung meminta `/sp5p-cfg.js`: +1 (mendapat decoy);
  - Worker / Pages Functions lain di akun yang sama.

---

## 9. Data siswa terenkripsi

`scripts/split-dsgan.js` menulis `data/nisn/<hash>.js` sebagai `window.__SP5P="..."`.
`<hash>` = 32 karakter pertama SHA-256(`_SP5P_KEY` + `|nisn|` + NISN). Key diambil dari
`_SP5P_KEY` di `src/index.src.html`. Kalau key diganti, nama file **dan** isinya ikut berubah;
workflow berjalan otomatis karena `src/index.src.html` berubah (bisa juga manual: Actions → Run workflow).
Untuk kembali ke teks biasa: set env `SP5P_ENCRYPT=0` pada langkah split (nama file tetap ter-hash).

## 10. Pengaturan Cloudflare yang disarankan (khusus kalau memakai domain sendiri)

- **Speed → Optimization**: matikan *Rocket Loader* (bisa merusak script ter-obfuscate).
- **Security → Bots**: aktifkan *Bot Fight Mode*.
- **Scrape Shield**: aktifkan *Hotlink Protection*.
- **Security → WAF → Rate limiting**: batasi mis. 60 request/menit per IP untuk `/data/*`.
- Pastikan repo GitHub **Private**: `dsgan.js`, `src/index.src.html`, dan `data/nisn/_index.json`
  berisi data/kode mentah.

## 11. Batas proteksi (jujur)

Agar hanya 1 hitungan per buka, `index.html`, `app.<hash>.js`, dan `data/*` kini static asset,
sehingga **curl bisa mengunduhnya** (dulu curl mendapat decoy, tapi itu pun bisa ditembus hanya dengan
menambah header `Sec-Fetch-*` palsu). Lapisan yang tetap ada:

- `app.<hash>.js` ter-obfuscate + kunci domain (salinan di domain lain tidak jalan).
- Data siswa terenkripsi **dan** nama filenya tidak bisa ditebak dari NISN; tanpa membongkar
  bundle ter-obfuscate, orang tidak bisa mengumpulkan data dengan mencoba-coba NISN.
- Config (`gasUrl`) hanya dari Worker, terenkripsi, dengan pemeriksaan UA + `Sec-Fetch-*`/Referer (decoy untuk scraper).
- Header keamanan (`X-Frame-Options`, `nosniff`, `frame-ancestors 'none'`, `noindex`, CORP same-origin untuk data).

Browser harus menerima kode agar bisa menjalankannya, jadi siapa pun yang cukup ahli tetap bisa
melihatnya lewat DevTools. Semua lapisan ini membuat pencurian jauh lebih sulit, bukan mustahil.
