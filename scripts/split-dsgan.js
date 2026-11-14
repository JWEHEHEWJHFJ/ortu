/**
 * split-dsgan.js
 * Memecah dsgan.js (window.SISWA_DATA = { GANJIL:{...}, GENAP:{...} })
 * menjadi banyak file kecil, satu file per siswa, disimpan di data/nisn/<fileId>.js
 *
 * <fileId> = hash dari NISN (lihat fileId() di sp5p-crypto.cjs), BUKAN NISN mentah,
 * supaya file tidak bisa ditebak/dikumpulkan dengan mencoba-coba NISN.
 * Aplikasi menghitung hash yang sama saat login (_sp5p_fileId di src/index.src.html).
 *
 * Cara pakai:
 *   node scripts/split-dsgan.js [path/ke/dsgan.js] [folder/output]
 *
 * Contoh:
 *   node scripts/split-dsgan.js dsgan.js data/nisn
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { readKey, encrypt, fileId } = require('./sp5p-crypto.cjs');

// Data siswa ditulis TERENKRIPSI (format window.__SP5P="...") yang sudah didukung
// index.src.html. Matikan dengan SP5P_ENCRYPT=0 (kembali ke teks biasa).
// Key tetap dibaca walau enkripsi dimatikan, karena nama file memakai hash dari key.
const ENCRYPT = process.env.SP5P_ENCRYPT !== '0';
const KEY = readKey();

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

  // Gabungkan per NISN dulu. Dulu file ditulis per semester, sehingga siswa yang ada
  // di GANJIL dan GENAP sekaligus kehilangan data GANJIL (tertimpa file GENAP).
  const perNisn = new Map(); // nisn -> { GANJIL: { nisn: {...} }, GENAP: { nisn: {...} } }
  const index = {};          // ringkasan untuk admin (TIDAK ikut ke dist)
  for (const semester of Object.keys(data)) {
    const students = data[semester] || {};
    for (const nisn of Object.keys(students)) {
      const studentData = students[nisn];
      if (!perNisn.has(nisn)) perNisn.set(nisn, {});
      perNisn.get(nisn)[semester] = { [nisn]: studentData };

      const id = fileId(nisn, KEY);
      const prev = index[nisn];
      index[nisn] = {
        file: id + '.js',
        semester: prev ? prev.semester + ',' + semester : semester,
        nama: studentData.nama || (prev && prev.nama) || '',
        kelas: studentData.kelas || (prev && prev.kelas) || '',
      };
    }
  }

  // Bersihkan file data lama (nama NISN mentah, siswa yang sudah keluar, dll.)
  // supaya tidak ada file yang tertinggal dan tetap bisa diakses publik.
  // Hanya file yang memang hasil split (dicek dari isinya) yang dihapus.
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let removed = 0;
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (!f.endsWith('.js')) continue;
    const p = path.join(OUT_DIR, f);
    const head = fs.readFileSync(p, 'utf8').slice(0, 200);
    if (head.startsWith('window.__SP5P=') || head.includes('Auto-generated dari')) {
      fs.unlinkSync(p);
      removed++;
    }
  }

  let count = 0;
  for (const [nisn, bySemester] of perNisn) {
    // Bentuk setelah didekripsi di browser: { "<SEMESTER>": { "<nisn>": {...} }, ... }
    const fileContent = ENCRYPT
      ? `window.__SP5P=${JSON.stringify(encrypt(JSON.stringify(bySemester), KEY))};\n`
      : `// Auto-generated dari ${path.basename(SRC_FILE)} - jangan edit manual\n` +
        `window.SISWA_DATA = ${JSON.stringify(bySemester, null, 2)};\n`;

    fs.writeFileSync(path.join(OUT_DIR, `${fileId(nisn, KEY)}.js`), fileContent, 'utf8');
    count++;
  }

  // _index.json: daftar NISN -> nama file. Hanya untuk admin; build.mjs TIDAK menyalinnya ke dist.
  fs.writeFileSync(path.join(OUT_DIR, '_index.json'), JSON.stringify(index, null, 2), 'utf8');

  console.log(`Selesai! ${count} file siswa dibuat di "${OUT_DIR}" (${removed} file lama dihapus).`);
  console.log(`File ringkasan: ${path.join(OUT_DIR, '_index.json')}`);
}

main();
