// api/ghfile.js
// Setara dengan handleGithubFile_() di code.gs
// Diakses via: /api/ghfile?path=namafile.ext
//
// PENTING: set environment variables ini di Vercel Dashboard
// (Project -> Settings -> Environment Variables), JANGAN hardcode di kode:
//   GITHUB_TOKEN   -> token BARU (revoke token lama yang bocor!)
//   GITHUB_OWNER
//   GITHUB_REPO
//   GITHUB_BRANCH  -> opsional, default "main"

export default async function handler(req, res) {
  const filePath = req.query.path;

  if (!filePath) {
    return res.status(400).json({ error: 'Parameter path wajib diisi' });
  }

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';

  if (!token || !owner || !repo) {
    return res.status(500).json({
      error: 'Environment variables belum lengkap (GITHUB_TOKEN/GITHUB_OWNER/GITHUB_REPO)'
    });
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(
    filePath
  )}?ref=${branch}`;

  try {
    const ghRes = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    if (!ghRes.ok) {
      const detail = await ghRes.text();
      return res.status(ghRes.status).json({
        error: `GitHub API gagal (${ghRes.status})`,
        detail
      });
    }

    const data = await ghRes.json();
    const decoded = Buffer.from(data.content, 'base64').toString('utf-8');

    return res.status(200).json({ path: filePath, content: decoded });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
