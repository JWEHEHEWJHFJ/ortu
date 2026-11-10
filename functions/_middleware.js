// Cloudflare Pages Functions (dipakai kalau deploy lewat Pages). Logika ada di edge/guard.js
import { guard } from '../edge/guard.js';
export const onRequest = (ctx) => guard(ctx);
