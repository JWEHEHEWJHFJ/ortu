// Pemakaian: node scripts/patch-index.js index.html public/index.html
// Mengubah index.html lama: hapus dekripsi/anti-F12/config klien, login & ganti password lewat /api.
const fs = require('fs');
const path = require('path');

const [inFile = 'index.html', outFile = 'public/index.html'] = process.argv.slice(2);
let s = fs.readFileSync(inFile, 'utf8');

function must(cond, msg) { if (!cond) { console.error('GAGAL: ' + msg); process.exit(1); } }
function cut(startMarker, endMarker, replacement, includeEnd) {
  const a = s.indexOf(startMarker);
  must(a !== -1, 'tidak menemukan awal: ' + startMarker);
  const b = s.indexOf(endMarker, a);
  must(b !== -1, 'tidak menemukan akhir: ' + endMarker);
  s = s.slice(0, a) + replacement + s.slice(b + (includeEnd ? endMarker.length : 0));
}

// 1) Hapus seluruh <script> pertama (kunci dekripsi, loader data/config, anti-F12, auto-reload)
const k = s.indexOf('const _SP5P_KEY');
must(k !== -1, 'blok _SP5P_KEY tidak ditemukan');
const scriptStart = s.lastIndexOf('<script>', k);
const scriptEnd = s.indexOf('</script>', k) + '</script>'.length;
must(scriptStart !== -1 && scriptEnd > scriptStart, 'batas <script> tidak valid');
s = s.slice(0, scriptStart) + s.slice(scriptEnd);

// 2) Ganti login()
const LOGIN = `let _sessPw = ''; // password hanya di memori selama sesi
    const login = async () => {
      if (!nisnInput.value || !passwordInput.value) { errorMessage.value = 'NISN dan Password harus diisi'; return; }
      if (!captchaInput.value.trim()) { errorMessage.value = 'Captcha harus diisi'; return; }
      if (captchaInput.value.trim().toUpperCase() !== captchaCode.value) {
        errorMessage.value = 'Captcha salah, silakan coba lagi.'; generateCaptcha(); return;
      }
      loading.value = true; errorMessage.value = '';
      try {
        const nisnStr = nisnInput.value.toString().trim();
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nisn: nisnStr, password: passwordInput.value, semester: selectedSemester.value || 'GANJIL' })
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out.ok) { loading.value = false; errorMessage.value = out.message || 'Login gagal.'; return; }
        const d = out.data || {};
        window.KALENDER_DATA = out.kalender || null;
        _sessPw = passwordInput.value;
        studentData.value = {
          nisn: nisnStr, nama: d.nama || '', kelas: d.kelas || '',
          nilaiAmbang: d.nilaiAmbang || '', kehadiranAmbang: d.kehadiranAmbang || '',
          rawSchedule: d.rawSchedule || '', rawAttendanceData: d.rawAttendanceData || '',
          rawAssessmentData: d.rawAssessmentData || '', rawNotesData: d.rawNotesData || '',
          abList: d.abList || [], nlList: d.nlList || []
        };
        // bersihkan sisa sesi lama yang menyimpan password di browser
        try { localStorage.removeItem(STORE_KEY); sessionStorage.removeItem(STORE_KEY); } catch (e) {}
        passwordInput.value = '';
        loggedIn.value = true; loading.value = false;
      } catch (err) {
        loading.value = false;
        errorMessage.value = 'Gagal login: ' + (err.message || 'Unknown error');
      }
    };

`;
cut('const login = async () => {', 'const HARI_ID', LOGIN, false);

// 3) Ganti doChangePassword()
const CHPW = `const doChangePassword = async () => {
      pwMsg.value = '';
      const fail = (m) => { pwMsg.value = m; pwMsgType.value = 'err'; };
      if (!pwOld.value) return fail('Password lama harus diisi.');
      if (pwOld.value !== _sessPw) return fail('Password lama tidak sesuai.');
      if (!pwNew.value) return fail('Password baru harus diisi.');
      if (pwNew.value.length < 4) return fail('Password baru minimal 4 karakter.');
      if (pwNew.value !== pwConfirm.value) return fail('Konfirmasi password baru tidak cocok.');
      if (pwNew.value === pwOld.value) return fail('Password baru tidak boleh sama dengan password lama.');

      pwLoading.value = true;
      try {
        const res = await fetch('/api/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nisn: studentData.value.nisn, semester: selectedSemester.value,
            oldPassword: _sessPw, newPassword: pwNew.value
          })
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out.success) throw new Error(out.message || 'Server menolak permintaan.');
        _sessPw = pwNew.value;
        pwMsgType.value = 'ok';
        pwMsg.value = '✅ Password berhasil diganti. Tunggu 10 sampai 15 menit agar password benar-benar terganti di server untuk disetujui oleh admin.';
        pwOld.value = ''; pwNew.value = ''; pwConfirm.value = '';
      } catch (err) {
        fail('Gagal: ' + (err.message || 'Tidak dapat terhubung ke server.'));
      }
      pwLoading.value = false;
    };

`;
cut('const doChangePassword = async () => {', 'const downloadPdf = () => {', CHPW, false);

// 4) Jangan isi otomatis password dari penyimpanan browser
must(s.includes("passwordInput.value = saved.password || '';"), 'baris autofill password tidak ditemukan');
s = s.replace("passwordInput.value = saved.password || '';", '');

// 5) Hapus pemanggilan loader config yang sudah tidak ada
must(s.includes('window._sp5pReady = window._sp5p_loadConfig();'), 'baris _sp5pReady tidak ditemukan');
s = s.replace('window._sp5pReady = window._sp5p_loadConfig();', '');

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, s);
console.log('Berhasil ->', outFile);
