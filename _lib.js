const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.cwd();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAIL = 5;
const hits = new Map(); // catatan: per-instance. Untuk produksi ketat pakai Upstash/Redis.

const ip = (req) => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || '?';
const keyOf = (req, nisn) => ip(req) + '|' + nisn;

function isLimited(req, nisn) {
  const e = hits.get(keyOf(req, nisn));
  return !!e && Date.now() - e.t < WINDOW_MS && e.n >= MAX_FAIL;
}
function addFail(req, nisn) {
  const k = keyOf(req, nisn), e = hits.get(k), now = Date.now();
  hits.set(k, !e || now - e.t >= WINDOW_MS ? { n: 1, t: now } : { n: e.n + 1, t: e.t });
}
function clearFail(req, nisn) { hits.delete(keyOf(req, nisn)); }

function hashPw(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + '$' + crypto.scryptSync(pw, salt, 32).toString('hex');
}
function verifyPw(pw, stored) {
  const [salt, hash] = String(stored || '').split('$');
  if (!salt || !hash) return false;
  const a = crypto.scryptSync(String(pw), salt, 32);
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function loadRow(nisn, semester) {
  if (!/^\d{5,20}$/.test(nisn)) return null;
  try {
    const db = JSON.parse(fs.readFileSync(path.join(ROOT, 'private', 'nisn', nisn + '.json'), 'utf8'));
    return (db[semester] && db[semester][nisn]) || db[nisn] || null;
  } catch { return null; }
}

function loadKalender(kelas) {
  if (!/^[\w.\- ]{1,20}$/.test(kelas || '')) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'private', 'kelas', kelas + '.json'), 'utf8'));
  } catch { return null; }
}

module.exports = { isLimited, addFail, clearFail, hashPw, verifyPw, loadRow, loadKalender };
