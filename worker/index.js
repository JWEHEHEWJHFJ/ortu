// Entry Worker (Workers + Static Assets). Logika ada di edge/guard.js
import { guard } from '../edge/guard.js';

export default {
  async fetch(request, env) {
    return guard({ request, env, next: () => env.ASSETS.fetch(request) });
  },
};
