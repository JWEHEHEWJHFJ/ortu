// api/login.js
import { getStudentAuth } from '../lib/db.js';
import { verifyPassword, createSessionToken, setSessionCookie } from '../lib/auth.js';

// Rate limiting sederhana di memori (per instance). Untuk produksi skala besar,
// pakai @vercel/kv atau Upstash Ratelimit agar konsisten lintas instance.
const attempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function tooManyAttempts(key) {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordAttempt(key) {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: Date.now() });
  } else {
    entry.count += 1;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { nisn, password } = req.body || {};
  if (!nisn || !password) {
    return res.status(400).json({ error: 'nisn dan password wajib diisi' });
  }

  if (tooManyAttempts(nisn)) {
    return res.status(429).json({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' });
  }

  const authRecord = await getStudentAuth(nisn);

  if (!authRecord || !(await verifyPassword(password, authRecord.passwordHash))) {
    recordAttempt(nisn);
    return res.status(401).json({ error: 'NISN atau password salah' });
  }

  const token = await createSessionToken(nisn);
  setSessionCookie(res, token);

  return res.status(200).json({
    ok: true,
    mustChangePassword: !!authRecord.mustChangePassword
  });
}
