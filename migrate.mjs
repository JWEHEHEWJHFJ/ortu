// scripts/migrate.mjs
//
// Jalankan SEKALI dari komputer kamu (bukan di client/browser) untuk memindahkan
// data dari format lama (mis. dsgan.js) ke Vercel KV, dengan password acak per siswa.
//
// Cara pakai:
//   1. npm install @vercel/kv bcryptjs
//   2. Set env vars KV_REST_API_URL & KV_REST_API_TOKEN (dari Vercel KV dashboard)
//   3. node scripts/migrate.mjs path/ke/data-lama.json
//
// Data lama harus dalam bentuk JSON murni (bukan "window.SISWA_DATA = {...}"),
// jadi buka dsgan.js, copy isi objeknya saja, simpan sebagai data-lama.json.
//
// Output: file credentials.csv berisi NISN + password awal untuk dibagikan
// ke masing-masing siswa secara aman (JANGAN publish file ini di mana pun).

import { readFileSync, writeFileSync } from 'fs';
import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/migrate.mjs path/ke/data-lama.json');
  process.exit(1);
}

// Aturan password awal (mengikuti sistem lama):
// - field "password" kosong di data lama -> password awal = NISN
// - field "password" sudah diisi di data lama -> pakai nilai itu apa adanya
function resolveInitialPassword(record, nisn) {
  const existing = (record.password || '').trim();
  if (existing.length > 0) {
    return { plainPassword: existing, isDefaultNisn: false };
  }
  return { plainPassword: nisn, isDefaultNisn: true };
}

async function main() {
  const raw = JSON.parse(readFileSync(inputPath, 'utf-8'));
  const csvRows = ['nisn,nama,password_awal,pakai_default_nisn'];
  let count = 0;

  for (const semester of Object.keys(raw)) {
    const students = raw[semester];
    for (const nisn of Object.keys(students)) {
      const record = students[nisn];
      const { plainPassword, isDefaultNisn } = resolveInitialPassword(record, nisn);
      const passwordHash = await bcrypt.hash(plainPassword, 10);

      // Data akademik (tanpa password) -> disimpan terpisah
      const { password, ...academicData } = record;
      await kv.set(`student:${nisn}`, academicData);

      // Kredensial -> disimpan terpisah dari data akademik.
      // mustChangePassword = true kalau password awalnya masih = NISN
      // (NISN bukan rahasia, jadi ini wajib diganti sebelum dipakai lama-lama).
      await kv.set(`auth:${nisn}`, {
        passwordHash,
        mustChangePassword: isDefaultNisn
      });

      csvRows.push(`${nisn},"${record.nama}",${plainPassword},${isDefaultNisn}`);
      count += 1;
    }
  }

  writeFileSync('credentials.csv', csvRows.join('\n'));
  console.log(`Selesai. ${count} siswa dimigrasikan.`);
  console.log('Password awal tersimpan di credentials.csv - simpan dengan aman, JANGAN commit ke git atau upload publik.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
