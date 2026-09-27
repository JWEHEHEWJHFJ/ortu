/**
 * split-dsgan.js
 * Memecah data/dsgan.js (window.SISWA_DATA = { GANJIL:{...}, GENAP:{...} })
 * menjadi banyak file kecil, satu file per NISN, disimpan di data/nisn/<nisn>.js
 *
 * Cara pakai:
 *   node split-dsgan.js [path/ke/dsgan.js] [folder/output]
 *
 * Contoh:
 *   node split-dsgan.js dsgan.js data/nisn
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC_FILE = process.argv[2] || 'dsgan.js';
const OUT_DIR = process.argv[3] || 'data/nisn';

function main() {
  if (!fs.existsSync(SRC_FILE)) {
    console.error(`File sumber tidak ditemukan: ${SRC_FILE}`);
    process.exit(1);
  }

  const code = fs.readFileSync(SRC_FILE, 'utf8');

  // Jalankan file asli di sandbox supaya "window.SISWA_DATA = {...}" bisa dibaca
  // tanpa perlu ubah format aslinya.
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);

  const data = sandbox.window.SISWA_DATA;
  if (!data) {
    console.error('window.SISWA_DATA tidak ditemukan di dalam file. Pastikan formatnya sesuai.');
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  let count = 0;
  const index = {}; // ringkasan: nisn -> { semester, nama, kelas }

  for (const semester of Object.keys(data)) {
    const students = data[semester] || {};
    for (const nisn of Object.keys(students)) {
      const studentData = students[nisn];

      // Setiap file berisi 1 siswa saja, tapi tetap dalam bentuk
      // window.SISWA_DATA = {...} supaya bisa langsung dipakai
      // menggantikan pola <script src="data/nisn/xxx.js"> di halaman lama.
      const fileContent =
        `// Auto-generated dari ${path.basename(SRC_FILE)} - jangan edit manual\n` +
        `window.SISWA_DATA = window.SISWA_DATA || {};\n` +
        `window.SISWA_DATA[${JSON.stringify(semester)}] = window.SISWA_DATA[${JSON.stringify(semester)}] || {};\n` +
        `window.SISWA_DATA[${JSON.stringify(semester)}][${JSON.stringify(nisn)}] = ${JSON.stringify(studentData, null, 2)};\n`;

      const safeName = String(nisn).replace(/[\/\\?%*:|"<>]/g, '-');
      fs.writeFileSync(path.join(OUT_DIR, `${safeName}.js`), fileContent, 'utf8');

      index[nisn] = {
        semester,
        nama: studentData.nama || '',
        kelas: studentData.kelas || ''
      };

      count++;
    }
  }

  // Simpan file index.json supaya frontend bisa tahu file mana yang harus di-load
  // untuk NISN tertentu (misalnya untuk membuat <script src="data/nisn/12345.js">).
  fs.writeFileSync(
    path.join(OUT_DIR, '_index.json'),
    JSON.stringify(index, null, 2),
    'utf8'
  );

  console.log(`Selesai! ${count} file NISN berhasil dibuat di folder "${OUT_DIR}".`);
  console.log(`File ringkasan: ${path.join(OUT_DIR, '_index.json')}`);
}

main();
