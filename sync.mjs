// scripts/sync.mjs
//
// Dipakai BERULANG setiap kali dsgan.js/kalgan.js sumbernya berubah
// (beda dengan migrate.mjs yang untuk migrasi awal SEKALI SAJA).
//
// Aturan penting:
// - Data akademik (student:${nisn}) SELALU di-update sesuai data terbaru.
// - Kredensial (auth:${nisn}) TIDAK PERNAH ditimpa untuk siswa yang sudah ada
//   -> password yang sudah diganti siswa tetap berlaku, tidak ke-reset ke NISN.
// - Siswa BARU yang belum punya akun -> dibuatkan akun default (password = NISN,
//   mustChangePassword: true), sama seperti alur migrate.mjs.
//
// Cara pakai:
//   node scripts/sync.mjs path/ke/data-terbaru.json
//
// Jalankan dari komputer/server tepercaya (bukan dari client/browser), dan
// idealnya dijadwalkan otomatis (lihat catatan "Otomatisasi" di README).

import { readFileSync, writeFileSync } from 'fs';
import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/sync.mjs path/ke/data-terbaru.json');
  process.exit(1);
}

async function main() {
  const raw = JSON.parse(readFileSync(inputPath, 'utf-8'));
  const newAccountRows = ['nisn,nama,password_awal'];
  let updated = 0;
  let created = 0;

  for (const semester of Object.keys(raw)) {
    const students = raw[semester];
    for (const nisn of Object.keys(students)) {
      const record = students[nisn];
      const { password, ...academicData } = record;

      // Selalu update data akademik ke versi terbaru
      await kv.set(`student:${nisn}`, academicData);
      updated += 1;

      // Cek apakah akun sudah ada - JANGAN sentuh kalau sudah ada
      const existingAuth = await kv.get(`auth:${nisn}`);
      if (existingAuth) continue;

      // Siswa baru -> buat akun default
      const initialPassword = (password || '').trim() || nisn;
      const passwordHash = await bcrypt.hash(initialPassword, 10);
      await kv.set(`auth:${nisn}`, {
        passwordHash,
        mustChangePassword: true
      });
      newAccountRows.push(`${nisn},"${record.nama}",${initialPassword}`);
      created += 1;
    }
  }

  console.log(`Sync selesai. ${updated} data akademik diperbarui, ${created} akun baru dibuat.`);

  if (created > 0) {
    writeFileSync('new-accounts.csv', newAccountRows.join('\n'));
    console.log('Akun baru tersimpan di new-accounts.csv - bagikan lewat jalur aman lalu hapus filenya.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
