const { isLimited, addFail, clearFail, verifyPw, loadRow } = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ success: false });

  const { nisn, semester, oldPassword, newPassword } = req.body || {};
  const n = String(nisn || '').trim();
  const sem = semester === 'GENAP' ? 'GENAP' : 'GANJIL';

  if (!/^\d{5,20}$/.test(n) || !oldPassword || !newPassword || String(newPassword).length < 4) {
    return res.status(400).json({ success: false, message: 'Data tidak valid.' });
  }
  if (isLimited(req, n)) {
    return res.status(429).json({ success: false, message: 'Terlalu banyak percobaan. Coba lagi nanti.' });
  }

  const row = loadRow(n, sem);
  if (!row || !verifyPw(oldPassword, row.passwordHash)) {
    addFail(req, n);
    return res.status(401).json({ success: false, message: 'Password lama tidak sesuai.' });
  }
  clearFail(req, n);

  const gasUrl = process.env.GAS_URL; // atur di Vercel > Settings > Environment Variables
  if (!gasUrl) return res.status(500).json({ success: false, message: 'Server belum dikonfigurasi.' });

  try {
    const r = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ nisn: n, newPassword }),
    });
    const out = JSON.parse(await r.text());
    if (!out.success) return res.status(502).json({ success: false, message: out.message || 'Server menolak permintaan.' });
    res.json({ success: true });
  } catch {
    res.status(502).json({ success: false, message: 'Gagal terhubung ke server data.' });
  }
};
