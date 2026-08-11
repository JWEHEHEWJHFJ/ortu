// api/me.js
// Mengembalikan HANYA data milik siswa yang sedang login (dari cookie session),
// bukan seluruh database.
import { getStudentData } from '../lib/db.js';
import { verifySessionToken, getSessionCookie } from '../lib/auth.js';

export default async function handler(req, res) {
  const token = getSessionCookie(req);
  if (!token) {
    return res.status(401).json({ error: 'Belum login' });
  }

  const payload = await verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Sesi tidak valid atau kedaluwarsa' });
  }

  const data = await getStudentData(payload.nisn);
  if (!data) {
    return res.status(404).json({ error: 'Data tidak ditemukan' });
  }

  return res.status(200).json({ data });
}
