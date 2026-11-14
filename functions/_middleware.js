// Cloudflare Pages Functions (dipakai kalau deploy lewat Pages). Logika ada di edge/guard.js
// dist/_routes.json membatasi Function ini HANYA untuk CFG_PATH, jadi path lain
// (termasuk bot/scanner) tidak pernah memanggil Function -> tidak dihitung.
import { isConfigPath, serveConfig } from '../edge/guard.js';

export const onRequest = (ctx) => {
  const url = new URL(ctx.request.url);
  return isConfigPath(url.pathname) ? serveConfig(ctx.request, ctx.env) : ctx.next();
};
