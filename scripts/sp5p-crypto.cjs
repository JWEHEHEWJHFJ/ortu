/**
 * sp5p-crypto.cjs
 * Enkripsi yang kompatibel dengan _sp5p_dec() di src/index.src.html.
 * Dipakai oleh: scripts/split-dsgan.js (data siswa) dan build.mjs (config.js).
 *
 * Format keluaran (base64): [28 byte header][ciphertext]
 * Ciphertext = plaintext(UTF-8) XOR keystream SHA-256 (sama persis dengan browser).
 * Header dibuat DETERMINISTIK (turunan hash isi) supaya file hasil split tidak
 * berubah kalau datanya tidak berubah -> commit/deploy tidak membengkak.
 *
 * Catatan jujur: key ikut terkirim ke browser (di dalam bundle ter-obfuscate),
 * jadi ini lapisan penghalang, bukan kerahasiaan mutlak.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function readKey(srcHtml) {
  const file = srcHtml || path.join(__dirname, '..', 'src', 'index.src.html');
  const html = fs.readFileSync(file, 'utf8');
  const m = html.match(/const\s+_SP5P_KEY\s*=\s*"([^"]+)"/);
  if (!m) throw new Error('_SP5P_KEY tidak ditemukan di ' + file);
  return m[1];
}

function keystream(key, len) {
  const keyHex = crypto.createHash('sha256').update(key, 'utf8').digest('hex');
  const blocks = Math.ceil(len / 32);
  const out = Buffer.alloc(blocks * 32);
  for (let b = 0; b < blocks; b++) {
    crypto.createHash('sha256').update(keyHex + ':' + b + ':' + key, 'utf8').digest().copy(out, b * 32);
  }
  return out;
}

function encrypt(plainText, key) {
  const pt = Buffer.from(plainText, 'utf8');
  const header = crypto.createHash('sha256').update(key + '|' + plainText, 'utf8').digest().subarray(0, 28);
  const ks = keystream(key, pt.length);
  const ct = Buffer.alloc(pt.length);
  for (let i = 0; i < pt.length; i++) ct[i] = pt[i] ^ ks[i];
  return Buffer.concat([header, ct]).toString('base64');
}

function decrypt(b64, key) {
  const bytes = Buffer.from(b64, 'base64');
  const ct = bytes.subarray(28);
  const ks = keystream(key, ct.length);
  const pt = Buffer.alloc(ct.length);
  for (let i = 0; i < ct.length; i++) pt[i] = ct[i] ^ ks[i];
  return pt.toString('utf8');
}

module.exports = { readKey, encrypt, decrypt };
