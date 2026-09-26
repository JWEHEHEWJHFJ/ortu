# Auto-split data siswa & kelas

Repo ini otomatis memecah dua file sumber:

- `data/dsgan.js` (`window.SISWA_DATA`) → satu file per NISN di `datasiswa/{nisn}.js`
- `data/kalgan.js` (`var kalender`) → satu file per kelas di `datakelas/{kelas}.js`

Setiap kali `data/dsgan.js` atau `data/kalgan.js` berubah (misalnya karena
Apps Script mengirim data terbaru dari Google Sheet), GitHub Actions otomatis
menjalankan ulang proses pemecahan dan meng-commit hasilnya.

## Struktur folder

```
data/
  dsgan.js         <- sumber, di-update oleh Apps Script
  kalgan.js        <- sumber, di-update oleh Apps Script
scripts/
  split-siswa.js   <- pecah dsgan.js -> datasiswa/*.js
  split-kelas.js   <- pecah kalgan.js -> datakelas/*.js
datasiswa/
  12345.js         <- hasil generate, jangan diedit manual
  ...
datakelas/
  X.1.js           <- hasil generate, jangan diedit manual
  ...
.github/workflows/
  split-data.yml   <- otomatisasi lewat GitHub Actions
```

## Langkah setup di GitHub (sekali saja)

1. Buat/pakai repo GitHub yang sudah ada untuk aplikasi guru ini.
2. Upload seluruh isi paket ini (folder `scripts/`, `.github/`, `README.md`)
   ke root repo, pertahankan strukturnya persis seperti di atas.
3. Pastikan Apps Script yang mengirim data selalu commit ke path yang SAMA:
   `data/dsgan.js` dan `data/kalgan.js` (bukan ke root repo). Kalau Apps
   Script Anda saat ini commit ke path lain, ubah path tujuannya, atau
   sesuaikan `SRC` di `scripts/split-siswa.js` / `scripts/split-kelas.js`
   supaya cocok dengan path yang dipakai Apps Script.
4. Masuk ke **Settings > Actions > General** di repo, pada bagian
   "Workflow permissions" pilih **"Read and write permissions"**, lalu
   Save. Ini wajib supaya workflow boleh push balik hasil pecahan
   (kalau tidak diaktifkan, langkah commit & push akan gagal karena
   token default read-only).
5. Commit & push. Setelah itu setiap push yang mengubah `data/dsgan.js`
   atau `data/kalgan.js` akan otomatis memicu workflow.

## Cara mengetes

- Cara cepat: buka tab **Actions** di repo → pilih workflow
  "Pecah Data Siswa & Kelas" → klik **Run workflow** untuk menjalankannya
  secara manual pakai data yang sudah ada di `data/`.
- Cara realistis: biarkan Apps Script mengirim update ke `data/dsgan.js`
  atau `data/kalgan.js` seperti biasa, lalu cek tab Actions — run baru
  akan otomatis muncul beberapa detik setelah commit dari Apps Script.
- Setelah run selesai (tanda centang hijau), cek folder `datasiswa/`
  dan `datakelas/` di repo — isinya harus sudah ter-update sesuai
  data terbaru.

## Menjalankan manual di komputer sendiri (opsional, untuk uji coba)

```bash
node scripts/split-siswa.js
node scripts/split-kelas.js
```

Butuh Node.js terpasang (versi berapa saja yang cukup baru, script ini
hanya pakai modul bawaan Node: `fs`, `path`, `vm`).

## Catatan

- File di `datasiswa/` dan `datakelas/` di-generate ulang total setiap
  kali workflow jalan (file lama dihapus dulu), jadi kalau ada
  siswa/kelas yang dihapus dari sheet, file lamanya juga otomatis hilang.
- Format isi tiap file dibuat semirip mungkin dengan file sumber
  (`window.SISWA_DATA = {...}` dan `var kalender = [...]`), supaya kode
  frontend yang sudah ada tetap bisa langsung memakainya tanpa perlu
  diubah — tinggal load file `datasiswa/{nisn}.js` atau
  `datakelas/{kelas}.js` yang relevan saja.
