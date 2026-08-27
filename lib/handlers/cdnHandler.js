import { runSql } from '../db.js';

export async function handleCdnAction(action, req, bodyData) {
  if (action === "get_cdn_config") {
    const rows = await runSql("SELECT key, value FROM system_config WHERE key LIKE 'cdn_%'");
    const config = {};
    (rows || []).forEach(r => { config[r.key] = r.value; });
    return { status: 200, json: { ok: true, config } };
  }

  if (action === "save_cdn_config") {
    for (const [k, v] of Object.entries(bodyData)) {
      if (k.startsWith('cdn_')) {
        await runSql("INSERT INTO system_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [k, String(v || '')]);
      }
    }
    return { status: 200, json: { ok: true } };
  }

  if (action === "list" || action === "cdn_list" || action === "cdn_gallery" || action === "get_cdn_gallery") {
    const rows = await runSql("SELECT * FROM cdn_gallery ORDER BY id DESC");
    return { status: 200, json: { ok: true, gallery: rows || [], items: rows || [] } };
  }

  if (action === "upload" || action === "cdn_upload") {
    const { filename, targetSize, originalKb, compressedKb, base64Data } = bodyData;
    
    let owner = process.env.CDN_GITHUB_OWNER || 'AllensCreations';
    let repo = process.env.CDN_GITHUB_REPO || 'Gallery';
    let branch = process.env.CDN_GITHUB_BRANCH || 'main';
    let uploadPath = process.env.CDN_UPLOAD_PATH || 'assets/rewards';
    let token = process.env.CDN_GITHUB_TOKEN;

    try {
      const configRows = await runSql("SELECT key, value FROM system_config WHERE key LIKE 'cdn_%'");
      const dbConfig = {};
      (configRows || []).forEach(r => { dbConfig[r.key] = r.value; });
      owner = dbConfig.cdn_github_owner || owner;
      repo = dbConfig.cdn_github_repo || repo;
      branch = dbConfig.cdn_github_branch || branch;
      uploadPath = dbConfig.cdn_upload_path || uploadPath;
      token = token || dbConfig.cdn_github_token;
    } catch (_) {}

    const cleanFilename = (filename || `image_${Date.now()}.webp`).trim();
    const filePath = `${uploadPath}/${cleanFilename}`.replace(/^\/+\//, '');
    const directUrl = `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${filePath}`;

    if (base64Data && token) {
      const githubApiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
      const base64Content = base64Data.includes('base64,') ? base64Data.split('base64,')[1] : base64Data;

      let sha = null;
      try {
        const checkRes = await fetch(`${githubApiUrl}?ref=${branch}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'TCRP-CDN-Uploader', 'Accept': 'application/vnd.github+json' }
        });
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          sha = checkData.sha;
        }
      } catch (_) {}

      const commitPayload = {
        message: `Upload CDN asset ${cleanFilename} via TCRP Gallery`,
        content: base64Content,
        branch: branch
      };
      if (sha) commitPayload.sha = sha;

      const commitRes = await fetch(githubApiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'TCRP-CDN-Uploader',
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(commitPayload)
      });

      if (!commitRes.ok) {
        const errJson = await commitRes.json().catch(() => ({}));
        return { status: 500, json: { ok: false, error: `GitHub Commit Failed: ${errJson.message || commitRes.statusText}` } };
      }
    }

    await runSql(`
      INSERT INTO cdn_gallery (filename, direct_url, size_label, original_kb, compressed_kb)
      VALUES (?, ?, ?, ?, ?)
    `, [cleanFilename, directUrl, targetSize || 'square_600', Number(originalKb) || 0, Number(compressedKb) || 0]);

    return { status: 200, json: { ok: true, direct_url: directUrl, item: { filename: cleanFilename, direct_url: directUrl, size_label: targetSize } } };
  }

  if (action === "delete" || action === "cdn_delete") {
    const id = Number(bodyData.id || req.query?.id);
    await runSql("DELETE FROM cdn_gallery WHERE id = ?", [id]);
    return { status: 200, json: { ok: true } };
  }

  return null;
}
