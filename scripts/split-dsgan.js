// scripts/split-dsgan.js
//
// Membaca dsgan.js (dan dsgen.js jika ada), lalu memecah window.SISWA_DATA
// menjadi satu file .js kecil per NISN, disimpan di folder siswa/.
//
// Struktur output: siswa/<SEMESTER>/<NISN>.js
//
// Dijalankan otomatis oleh GitHub Actions setiap kali dsgan.js/dsgen.js berubah.
// Bisa juga dijalankan manual: node scripts/split-dsgan.js

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

// Pasangan [file sumber, folder output]. dsgen.js ikut diproses kalau ada,
// supaya semester genap juga otomatis terpecah begitu file itu ditambahkan.
const SOURCES = [
  { src: "dsgan.js", outDir: "siswa" },
  { src: "dsgen.js", outDir: "siswa" },
];

function sanitize(name) {
  return String(name).trim().replace(/[^a-zA-Z0-9._-]/g, "_") || "_";
}

function loadSiswaData(filePath) {
  const code = fs.readFileSync(filePath, "utf8");

  // Format baru (terenkripsi via window.__SP5P) tidak bisa dipecah di sini
  // karena isinya ciphertext, bukan objek JS biasa.
  if (code.indexOf('window.__SP5P="') !== -1) {
    throw new Error(
      `${path.basename(filePath)} berformat terenkripsi (window.__SP5P), ` +
        `tidak bisa dipecah otomatis dari sini.`
    );
  }

  const fn = new Function(
    "window",
    code + "\nreturn window.SISWA_DATA;"
  );
  return fn({});
}

function writeSiswaFile(outDir, semester, nisn, record) {
  const semesterDir = path.join(outDir, sanitize(semester));
  fs.mkdirSync(semesterDir, { recursive: true });

  const filePath = path.join(semesterDir, `${sanitize(nisn)}.js`);
  const content = `// File ini di-generate OTOMATIS dari dsgan.js/dsgen.js berdasarkan NISN.
// JANGAN diedit manual — perubahan akan tertimpa saat file sumber berubah.
// Semester : ${semester}
// NISN     : ${nisn}
// Nama     : ${record && record.nama ? record.nama : "-"}
// Diperbarui: ${new Date().toISOString()}

window.SISWA_DATA = window.SISWA_DATA || {};
window.SISWA_DATA[${JSON.stringify(semester)}] = window.SISWA_DATA[${JSON.stringify(
    semester
  )}] || {};
window.SISWA_DATA[${JSON.stringify(semester)}][${JSON.stringify(
    nisn
  )}] = ${JSON.stringify(record, null, 2)};
`;
  fs.writeFileSync(filePath, content, "utf8");
}

function main() {
  let totalFile = 0;
  let totalSumberDiproses = 0;
  const indexData = {};

  for (const { src, outDir: outDirName } of SOURCES) {
    const srcPath = path.join(ROOT, src);
    if (!fs.existsSync(srcPath)) continue; // dsgen.js opsional, boleh belum ada

    totalSumberDiproses++;
    const outDir = path.join(ROOT, outDirName);

    let data;
    try {
      data = loadSiswaData(srcPath);
    } catch (err) {
      console.error(`Gagal membaca ${src}: ${err.message}`);
      continue;
    }

    if (!data || typeof data !== "object") {
      console.error(`window.SISWA_DATA tidak ditemukan / tidak valid di ${src}`);
      continue;
    }

    for (const semester of Object.keys(data)) {
      const siswaPerSemester = data[semester] || {};
      indexData[semester] = indexData[semester] || [];

      for (const nisn of Object.keys(siswaPerSemester)) {
        writeSiswaFile(outDir, semester, nisn, siswaPerSemester[nisn]);
        indexData[semester].push(nisn);
        totalFile++;
      }
    }
  }

  if (totalSumberDiproses === 0) {
    console.error("Tidak ada dsgan.js / dsgen.js yang ditemukan. Berhenti.");
    process.exit(1);
  }

  // Simpan daftar NISN per semester supaya mudah ditelusuri dari luar.
  const siswaDir = path.join(ROOT, "siswa");
  fs.mkdirSync(siswaDir, { recursive: true });
  fs.writeFileSync(
    path.join(siswaDir, "index.json"),
    JSON.stringify(indexData, null, 2) + "\n",
    "utf8"
  );

  console.log(`Selesai. ${totalFile} file siswa dibuat/diperbarui di folder siswa/.`);
}

main();
