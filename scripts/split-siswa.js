// scripts/split-siswa.js
// Memecah data/dsgan.js (window.SISWA_DATA) menjadi satu file per NISN
// di folder datasiswa/, misalnya datasiswa/12345.js
//
// Jalankan: node scripts/split-siswa.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'data', 'dsgan.js');
const OUT_DIR = path.join(__dirname, '..', 'datasiswa');

function loadSiswaData(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  // dsgan.js menulis ke "window.SISWA_DATA", jadi kita sediakan objek window palsu
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'dsgan.js' });

  if (!sandbox.window || !sandbox.window.SISWA_DATA) {
    throw new Error('window.SISWA_DATA tidak ditemukan di ' + filePath);
  }
  return sandbox.window.SISWA_DATA;
}

function sanitizeFileName(name) {
  return String(name).trim().replace(/[\\/:*?"<>|]/g, '_');
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.log('data/dsgan.js tidak ditemukan, lewati split siswa.');
    return;
  }

  const data = loadSiswaData(SRC);
  const semesters = Object.keys(data); // contoh: ["GANJIL", "GENAP"]

  // Kumpulkan semua NISN yang muncul di semester manapun
  const allNisn = new Set();
  for (const sem of semesters) {
    Object.keys(data[sem] || {}).forEach((nisn) => allNisn.add(nisn));
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Bersihkan file lama supaya siswa yang sudah dihapus dari sheet
  // tidak nyangkut sebagai file yatim
  fs.readdirSync(OUT_DIR)
    .filter((f) => f.endsWith('.js'))
    .forEach((f) => fs.unlinkSync(path.join(OUT_DIR, f)));

  let count = 0;
  for (const nisn of allNisn) {
    const perStudent = {};
    for (const sem of semesters) {
      perStudent[sem] =
        data[sem] && data[sem][nisn] ? { [nisn]: data[sem][nisn] } : {};
    }

    const fileName = sanitizeFileName(nisn) + '.js';
    const outPath = path.join(OUT_DIR, fileName);
    const content =
      '// File ini di-generate otomatis dari data/dsgan.js. Jangan edit manual, perubahan akan tertimpa.\n' +
      `window.SISWA_DATA = ${JSON.stringify(perStudent, null, 2)};\n`;

    fs.writeFileSync(outPath, content, 'utf8');
    count++;
  }

  console.log(`[split-siswa] Selesai: ${count} file siswa ditulis ke datasiswa/`);
}

main();
