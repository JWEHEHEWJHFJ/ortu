// public/app-example.js
// Contoh pemanggilan dari sisi browser. Tidak ada data siswa yang tersimpan
// di file ini - semua diambil dari server SETELAH login berhasil.

async function login(nisn, password) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nisn, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login gagal');
  return data; // { ok: true, mustChangePassword }
}

async function getMyData() {
  const res = await fetch('/api/me'); // cookie session otomatis terkirim
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Gagal mengambil data');
  return data.data; // hanya data milik siswa yang login
}

async function changePassword(newPassword) {
  const res = await fetch('/api/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newPassword })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Gagal ganti password');
  return data;
}

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
}
