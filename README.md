# Siswa Portal - arsitektur aman

Data akademik siswa disimpan di server (Vercel KV), bukan di file JS yang dikirim
ke browser. Setiap siswa login dengan NISN + password sendiri, dan hanya bisa
mengambil datanya sendiri lewat `/api/me`.

## Setup

1. **Buat Vercel KV database**
   Vercel Dashboard -> Storage -> Create Database -> KV.
   Setelah dibuat, connect ke project ini - env vars `KV_REST_API_URL` dan
   `KV_REST_API_TOKEN` akan otomatis terisi di project Vercel kamu.

2. **Set `SESSION_SECRET`**
   Generate: `openssl rand -base64 32`
   Tambahkan di Vercel Dashboard -> Settings -> Environment Variables.

3. **Siapkan data lama sebagai JSON murni**
   Buka `dsgan.js`, copy isi `window.SISWA_DATA = { ... }` (tanpa bagian
   `window.SISWA_DATA =` dan tanpa titik koma di akhir), simpan sebagai
   `data-lama.json`.

4. **Migrasi data (jalankan LOKAL di komputermu, bukan di client/browser)**
   ```bash
   npm install
   export KV_REST_API_URL=...
   export KV_REST_API_TOKEN=...
   node scripts/migrate.mjs data-lama.json
   ```
   Aturan password awal mengikuti sistem lama: kalau field `password` di data
   lama kosong, password awal = NISN siswa itu sendiri; kalau sudah diisi,
   dipakai apa adanya. Hasilnya ditulis ke `credentials.csv`.
   **Jangan commit atau upload file ini ke mana pun** - bagikan ke tiap siswa
   lewat jalur aman (misal wali kelas membagikan langsung), lalu hapus file
   itu dari komputermu setelah dibagikan.

   Catatan: NISN bukan data rahasia (tertera di kartu pelajar/rapor), jadi
   akun yang password awalnya masih = NISN otomatis ditandai
   `mustChangePassword: true` dan sistem akan memaksa ganti password saat
   login pertama (lihat `/api/change-password`).

5. **Hapus `dsgan.js`, `kalgan.js`, dan `config.js` lama dari project/repo**
   Data sensitifnya sudah pindah ke KV. Kalau file-file ini pernah ter-commit
   ke git, hapus juga dari history (`git filter-repo` atau BFG Repo-Cleaner),
   karena `git rm` biasa tidak menghapusnya dari riwayat commit.

6. **Deploy**
   ```bash
   vercel deploy
   ```

## Kalau data sumbernya sering berubah (rutin update nilai/absensi)

Jangan jalankan `migrate.mjs` berulang kali - itu untuk migrasi awal saja.
Untuk update rutin, pakai `sync.mjs`:

```bash
node scripts/sync.mjs data-terbaru.json
```

Bedanya dengan `migrate.mjs`:
- Data akademik (nilai, absensi, dst) selalu diperbarui ke versi terbaru.
- Password siswa yang sudah ada **tidak pernah ikut ter-reset**, walau data
  akademiknya berubah - jadi siswa yang sudah ganti password tidak perlu
  login ulang pakai NISN.
- Siswa baru yang belum punya akun otomatis dibuatkan akun default (password
  = NISN, wajib ganti saat login pertama), dicatat di `new-accounts.csv`.

Siswa yang hilang dari data terbaru (lulus/pindah) tidak otomatis terhapus
dari KV oleh script ini - hapus manual via `kv.del('student:NISN')` dan
`kv.del('auth:NISN')` kalau memang perlu dinonaktifkan.

### Otomatisasi (opsional)

Kalau proses ekspor data lama (dari Google Apps Script / sistem sekolah) bisa
memanggil URL, kamu bisa bungkus `sync.mjs` jadi endpoint API yang dilindungi
secret key (mis. header `x-sync-secret` dicocokkan ke env var), lalu dipanggil
otomatis setiap ekspor baru selesai - daripada dijalankan manual tiap kali.
Beri tahu saya kalau mau saya buatkan versi endpoint-nya.



- `POST /api/login` -> body `{ nisn, password }` -> set cookie session (HttpOnly).
- `GET /api/me` -> kembalikan data akademik milik siswa yang login saja.
- `POST /api/change-password` -> wajib dipanggil kalau `mustChangePassword: true`.
- `POST /api/logout` -> hapus cookie session.

## Kenapa ini lebih aman dari sebelumnya

- Tidak ada database siswa yang dikirim utuh ke browser - jadi tidak ada lagi
  alasan untuk mencoba memblokir DevTools atau menghapus file saat terdeteksi.
- Password di-hash (bcrypt), bukan disimpan polos atau dikosongkan seperti data lama.
- Kredensial disimpan terpisah dari data akademik.
- Session pakai cookie `HttpOnly` + `Secure` sehingga tidak bisa dibaca lewat
  JavaScript di browser sekalipun (melindungi dari XSS mencuri sesi).
