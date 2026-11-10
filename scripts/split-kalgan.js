/**
 * split-kalgan.js
 * Memecah data/kalgan.js (var kalender = [ [kelas, ...kolom..., tahun], ... ])
 * menjadi banyak file kecil, satu file per kelas, disimpan di data/kelas/<kelas>.js
 *
 * Cara pakai:
 *   node split-kalgan.js [path/ke/kalgan.js] [folder/output]
 *
 * Contoh:
 *   node split-kalgan.js kalgan.js data/kelas
 */

const fs = require('fs');
const path = require('path');

const SRC_FILE = process.argv[2] || 'kalgan.js';
const OUT_DIR = process.argv[3] || 'data/kelas';

function main() {
  if (!fs.existsSync(SRC_FILE)) {
    console.error(`File sumber tidak ditemukan: ${SRC_FILE}`);
    process.exit(1);
  }

  // kalgan.js sudah punya "module.exports = kalender" di baris terakhir,
  // jadi bisa langsung di-require.
  const kalender = require(path.resolve(SRC_FILE));

  if (!Array.isArray(kalender)) {
    console.error('Isi kalgan.js tidak berupa array seperti yang diharapkan.');
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  let count = 0;
  let skipped = 0;
  const index = []; // daftar kelas yang berhasil dipecah

  for (const row of kalender) {
    const kelas = Array.isArray(row) ? row[0] : null;

    // Lewati baris yang kelasnya kosong (baris sampah/placeholder)
    if (!kelas || String(kelas).trim() === '') {
      skipped++;
      continue;
    }

    const safeFileName = String(kelas).replace(/[\/\\?%*:|"<>]/g, '-');
    const varName = 'kalender_' + safeFileName.replace(/[^a-zA-Z0-9_]/g, '_');

    const fileContent =
      `// Auto-generated dari ${path.basename(SRC_FILE)} - jangan edit manual\n` +
      `// Data kalender untuk kelas: ${kelas}\n` +
      `var ${varName} = ${JSON.stringify(row, null, 2)};\n\n` +
      `if (typeof module !== 'undefined') { module.exports = ${varName}; }\n`;

    fs.writeFileSync(path.join(OUT_DIR, `${safeFileName}.js`), fileContent, 'utf8');

    index.push(kelas);
    count++;
  }

  fs.writeFileSync(
    path.join(OUT_DIR, '_index.json'),
    JSON.stringify(index, null, 2),
    'utf8'
  );

  console.log(`Selesai! ${count} file kelas berhasil dibuat di folder "${OUT_DIR}".`);
  if (skipped > 0) console.log(`${skipped} baris dilewati karena nama kelas kosong.`);
  console.log(`File ringkasan: ${path.join(OUT_DIR, '_index.json')}`);
}

main();
