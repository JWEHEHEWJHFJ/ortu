// Pemakaian: node scripts/convert-data.js [folder-data-lama=./data]
// Hasil: private/nisn/{NISN}.json (password ter-hash) dan private/kelas/{kelas}.json
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SRC = process.argv[2] || './data';
const OUT = './private';
const OLD_KEY = 'sp5p_enc_2025_sman5pinrang_secure!'; // kunci lama, hanya dipakai di sini

function decrypt(b64) {
  const bytes = Buffer.from(b64, 'base64');
  const ct = bytes.subarray(28);
  const keyHex = crypto.createHash('sha256').update(OLD_KEY).digest('hex');
  const ks = Buffer.alloc(Math.ceil(ct.length / 32) * 32);
  for (let b = 0; b < ks.length / 32; b++) {
    crypto.createHash('sha256').update(keyHex + ':' + b + ':' + OLD_KEY).digest().copy(ks, b * 32);
  }
  const pt = Buffer.alloc(ct.length);
  for (let i = 0; i < ct.length; i++) pt[i] = ct[i] ^ ks[i];
  return pt.toString('utf8');
}

const hashPw = (pw) => {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + '$' + crypto.scryptSync(pw, salt, 32).toString('hex');
};

function readNisn(file) {
  const js = fs.readFileSync(file, 'utf8');
  const marker = 'window.__SP5P="';
  const i = js.indexOf(marker);
  if (i !== -1) {
    const s = i + marker.length;
    return JSON.parse(decrypt(js.substring(s, js.indexOf('"', s))));
  }
  return new Function(js + '; return window.SISWA_DATA;').call({}) ;
}

fs.mkdirSync(path.join(OUT, 'nisn'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'kelas'), { recursive: true });

let nCount = 0;
const nisnDir = path.join(SRC, 'nisn');
for (const f of fs.existsSync(nisnDir) ? fs.readdirSync(nisnDir) : []) {
  if (!f.endsWith('.js')) continue;
  const nisn = f.replace(/\.js$/, '');
  try {
    globalThis.window = globalThis.window || {};
    const db = readNisn(path.join(nisnDir, f));
    for (const sem of ['GANJIL', 'GENAP']) {
      const row = db[sem] && db[sem][nisn];
      if (!row) continue;
      const pw = (row.password || '').trim() || nisn; // aturan lama: kosong = NISN
      row.passwordHash = hashPw(pw);
      delete row.password;
    }
    fs.writeFileSync(path.join(OUT, 'nisn', nisn + '.json'), JSON.stringify(db));
    nCount++;
  } catch (e) { console.error('GAGAL', f, e.message); }
}

let kCount = 0;
const kelasDir = path.join(SRC, 'kelas');
for (const f of fs.existsSync(kelasDir) ? fs.readdirSync(kelasDir) : []) {
  if (!f.endsWith('.js')) continue;
  const kelas = f.replace(/\.js$/, '');
  try {
    const js = fs.readFileSync(path.join(kelasDir, f), 'utf8');
    const v = 'kalender_' + kelas.replace(/[^a-zA-Z0-9]+/g, '_');
    const r = new Function(js + `; return (typeof ${v} !== 'undefined') ? ${v} : (typeof kalender !== 'undefined' ? kalender : null);`)();
    if (!r) throw new Error('variabel kalender tidak ditemukan');
    fs.writeFileSync(path.join(OUT, 'kelas', kelas + '.json'), JSON.stringify(Array.isArray(r[0]) ? r : [r]));
    kCount++;
  } catch (e) { console.error('GAGAL', f, e.message); }
}
console.log(`Selesai: ${nCount} file siswa, ${kCount} file kelas -> ${OUT}`);
