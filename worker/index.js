// Entry Worker (Workers + Static Assets). Logika ada di edge/guard.js
//
// Worker ini HANYA berjalan untuk:
//   1. CFG_PATH (/sp5p-cfg.js) -> diminta aplikasi 1x setiap halaman dibuka.
//   2. Path yang TIDAK ada di dist/ dan bukan navigasi browser (bot/scanner) -> 404 cepat.
//      Ini tidak bisa dicegah 100% selama ada Worker script (lihat README).
// Semua file lain (index.html, app.<hash>.js, data/*, favicon, robots.txt, 404.html)
// disajikan langsung sebagai static asset: GRATIS dan TIDAK dihitung di "Requests today".
import { isConfigPath, serveConfig, notFound } from '../edge/guard.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (isConfigPath(url.pathname)) return serveConfig(request, env);
    return notFound();
  },
};
