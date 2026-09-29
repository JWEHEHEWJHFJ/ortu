const { isLimited, addFail, clearFail, verifyPw, loadRow, loadKalender } = require('./_lib');

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const { nisn, password, semester } = req.body || {};
  const n = String(nisn || '').trim();
  const sem = semester === 'GENAP' ? 'GENAP' : 'GANJIL';
  if (!/^\d{5,20}$/.test(n) || !password) {
    return res.status(400).json({ ok: false, message: 'NISN dan Password harus diisi' });
  }
  if (isLimited(req, n)) {
    return res.status(429).json({ ok: false, message: 'Terlalu banyak percobaan. Coba lagi dalam 10 menit.' });
  }

  const row = loadRow(n, sem);
  if (!row || !verifyPw(password, row.passwordHash)) {
    addFail(req, n);
    return res.status(401).json({ ok: false, message: 'NISN atau password salah.' });
  }
  clearFail(req, n);

  // whitelist field; password/hash TIDAK ikut dikirim
  const data = {
    nama: row.nama || '', kelas: row.kelas || '',
    nilaiAmbang: row.nilaiAmbang || '', kehadiranAmbang: row.kehadiranAmbang || '',
    rawSchedule: row.rawSchedule || '', rawAttendanceData: row.rawAttendanceData || '',
    rawAssessmentData: row.rawAssessmentData || '', rawNotesData: row.rawNotesData || '',
    abList: row.abList || [], nlList: row.nlList || [],
  };
  res.json({ ok: true, data, kalender: loadKalender(row.kelas) });
};
