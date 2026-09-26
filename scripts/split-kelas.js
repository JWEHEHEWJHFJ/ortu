// scripts/split-kelas.js
// Memecah data/kalgan.js (var kalender = [[...], [...], ...]) menjadi
// satu file per kelas di folder datakelas/, misalnya datakelas/X.1.js
//
// Jalankan: node scripts/split-kelas.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'data', 'kalgan.js');
const OUT_DIR = path.join(__dirname, '..', 'datakelas');

function loadKalenderData(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'kalgan.js' });

  if (!sandbox.kalender) {
    throw new Error('Variabel kalender tidak ditemukan di ' + filePath);
  }
  return sandbox.kalender;
}

function sanitizeFileName(name) {
  return String(name).trim().replace(/[\\/:*?"<>|]/g, '_');
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.log('data/kalgan.js tidak ditemukan, lewati split kelas.');
    return;
  }

  const kalender = loadKalenderData(SRC);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Bersihkan file lama supaya kelas yang sudah dihapus/berganti nama
  // tidak nyangkut sebagai file yatim
  fs.readdirSync(OUT_DIR)
    .filter((f) => f.endsWith('.js'))
    .forEach((f) => fs.unlinkSync(path.join(OUT_DIR, f)));

  let count = 0;
  for (const row of kalender) {
    const kelas = row && row[0] ? String(row[0]).trim() : '';
    if (!kelas) continue; // lewati baris kosong (kelas belum diisi di sheet)

    const fileName = sanitizeFileName(kelas) + '.js';
    const outPath = path.join(OUT_DIR, fileName);
    const content =
      '// File ini di-generate otomatis dari data/kalgan.js. Jangan edit manual, perubahan akan tertimpa.\n' +
      `var kalender = ${JSON.stringify([row], null, 2)};\n`;

    fs.writeFileSync(outPath, content, 'utf8');
    count++;
  }

  console.log(`[split-kelas] Selesai: ${count} file kelas ditulis ke datakelas/`);
}

main();
