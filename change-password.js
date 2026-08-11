// api/change-password.js
import { getStudentAuth, setStudentAuth } from '../lib/db.js';
import { verifySessionToken, getSessionCookie, hashPassword } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = getSessionCookie(req);
  const payload = token && (await verifySessionToken(token));
  if (!payload) {
    return res.status(401).json({ error: 'Belum login' });
  }

  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password baru minimal 8 karakter' });
  }

  const authRecord = await getStudentAuth(payload.nisn);
  const passwordHash = await hashPassword(newPassword);

  await setStudentAuth(payload.nisn, {
    ...authRecord,
    passwordHash,
    mustChangePassword: false
  });

  return res.status(200).json({ ok: true });
}
