// api/index.js
// Setara dengan handleMainPage_() di code.gs
// Meng-proxy halaman target dan menyisipkan <base href> agar path relatif tetap resolve ke domain asli.

const TARGET_URL = process.env.TARGET_URL || 'https://jwehehewjhfj.github.io/ortu/';

export default async function handler(req, res) {
  try {
    const upstream = await fetch(TARGET_URL, { method: 'GET', redirect: 'follow' });
    let html = await upstream.text();

    const injectTag = `<base href="${TARGET_URL}">`;

    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head([^>]*)>/i, `<head$1>${injectTag}`);
    } else {
      html = injectTag + html;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Vercel default sudah mengizinkan embedding; sesuaikan header ini
    // sesuai kebutuhanmu (mis. X-Frame-Options) daripada meniadakannya secara blanket.
    res.status(200).send(html);
  } catch (err) {
    res.status(502).send(`<p>Gagal memuat halaman: ${err.message}</p>`);
  }
}
