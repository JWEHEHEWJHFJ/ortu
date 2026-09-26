// scripts/split-kalgan.js
//
// Membaca kalgan.js (dan kalgen.js jika ada), lalu memecah variabel
// `kalender` menjadi satu file .js kecil per kelas, disimpan di folder kelas/.
//
// Struktur output: kelas/<KELAS>.js  (mis. kelas/X.1.js, kelas/XI.3.js, dst)
//
// Dijalankan otomatis oleh GitHub Actions setiap kali kalgan.js/kalgen.js berubah.
// Bisa juga dijalankan manual: node scripts/split-kalgan.js

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

// [file sumber, nama variabel semester untuk penamaan, folder output]
const SOURCES = [
  { src: "kalgan.js", label: "GANJIL" },
  { src: "kalgen.js", label: "GENAP" },
];

function sanitize(name) {
  return String(name).trim().replace(/[^a-zA-Z0-9._-]/g, "_") || "_";
}

function loadKalender(filePath) {
  const code = fs.readFileSync(filePath, "utf8");
  const fn = new Function(
    code + '\nreturn (typeof kalender !== "undefined") ? kalender : null;'
  );
  return fn();
}

function writeKelasFile(outDir, semesterLabel, kelas, row) {
  const filePath = path.join(outDir, `${sanitize(kelas)}.js`);
  const varName = "kalenderKelas";
  const content = `// File ini di-generate OTOMATIS dari kalgan.js/kalgen.js berdasarkan kelas.
// JANGAN diedit manual — perubahan akan tertimpa saat file sumber berubah.
// Semester : ${semesterLabel}
// Kelas    : ${kelas}
// Diperbarui: ${new Date().toISOString()}

var ${varName} = ${JSON.stringify(row, null, 2)};
`;
  fs.writeFileSync(filePath, content, "utf8");
}

function main() {
  let totalFile = 0;
  let totalSumberDiproses = 0;
  const indexData = {};

  for (const { src, label } of SOURCES) {
    const srcPath = path.join(ROOT, src);
    if (!fs.existsSync(srcPath)) continue; // kalgen.js opsional, boleh belum ada

    totalSumberDiproses++;

    let kalender;
    try {
      kalender = loadKalender(srcPath);
    } catch (err) {
      console.error(`Gagal membaca ${src}: ${err.message}`);
      continue;
    }

    if (!Array.isArray(kalender)) {
      console.error(`Variabel 'kalender' tidak ditemukan / tidak valid di ${src}`);
      continue;
    }

    // Semua kelas dari semua sumber ditulis ke satu folder kelas/ yang sama,
    // ditandai per baris lewat komentar semester di dalam file.
    const outDir = path.join(ROOT, "kelas");
    fs.mkdirSync(outDir, { recursive: true });

    indexData[label] = [];

    for (const row of kalender) {
      const kelas = row && row[0];
      if (!kelas || !String(kelas).trim()) continue; // lewati baris kosong/padding

      writeKelasFile(outDir, label, kelas, row);
      indexData[label].push(kelas);
      totalFile++;
    }
  }

  if (totalSumberDiproses === 0) {
    console.error("Tidak ada kalgan.js / kalgen.js yang ditemukan. Berhenti.");
    process.exit(1);
  }

  const kelasDir = path.join(ROOT, "kelas");
  fs.mkdirSync(kelasDir, { recursive: true });
  fs.writeFileSync(
    path.join(kelasDir, "index.json"),
    JSON.stringify(indexData, null, 2) + "\n",
    "utf8"
  );

  console.log(`Selesai. ${totalFile} file kelas dibuat/diperbarui di folder kelas/.`);
}

main();
