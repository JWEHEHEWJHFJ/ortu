// edge/paths.mjs — SATU-SATUNYA path yang menjalankan Worker / Pages Function.
// Setiap kali halaman dibuka, aplikasi meminta path ini tepat 1 kali
// (inilah satu-satunya hitungan di "Requests today").
// Kalau diganti, ganti juga konstanta _SP5P_CFG_PATH di src/index.src.html
// (build.mjs akan gagal kalau keduanya tidak sama).
export const CFG_PATH = '/sp5p-cfg.js';
