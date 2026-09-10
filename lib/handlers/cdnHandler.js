import { runSql } from '../db.js';

function resolveGitHubToken(dbConfig = {}, bodyData = {}) {
  const candidates = [
    bodyData.token,
    dbConfig.cdn_github_token,
    process.env.CDN_GITHUB_TOKEN,
    process.env.GITHUB_TOKEN,
    process.env.GH_TOKEN,
    process.env.GITHUB_PAT,
    process.env.GH_PAT,
    process.env.GIT_TOKEN
  ];
  for (const c of candidates) {
    if (c && typeof c === 'string' && c.trim().length > 5) {
      return c.trim();
    }
  }
  return '';
}

function resolveCdnConfig(dbConfig = {}) {
  return {
    owner: (dbConfig.cdn_github_owner || process.env.CDN_GITHUB_OWNER || 'AllensCreations').trim(),
    repo: (dbConfig.cdn_github_repo || process.env.CDN_GITHUB_REPO || 'Gallery').trim(),
    branch: (dbConfig.cdn_github_branch || process.env.CDN_GITHUB_BRANCH || 'main').trim(),
    uploadPath: (dbConfig.cdn_upload_path || process.env.CDN_UPLOAD_PATH || 'assets/rewards').trim()
  };
}

export async function handleCdnAction(action, req, bodyData) {
  // Ensure cdn_gallery table exists
  await runSql(`
    CREATE TABLE IF NOT EXISTS cdn_gallery (
      id integer PRIMARY KEY AUTOINCREMENT,
      filename text,
      direct_url text,
      size_label text,
      original_kb real DEFAULT 0,
      compressed_kb real DEFAULT 0,
      created_at text DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {});

  if (action === "get_cdn_config") {
    const rows = await runSql("SELECT key, value FROM system_settings WHERE key LIKE 'cdn_%'").catch(() => []);
    const dbConfig = {};
    (rows || []).forEach(r => { dbConfig[r.key] = r.value; });

    const { owner, repo, branch, uploadPath } = resolveCdnConfig(dbConfig);
    const token = resolveGitHubToken(dbConfig, bodyData);

    return {
      status: 200,
      json: {
        ok: true,
        config: {
          cdn_github_owner: owner,
          cdn_github_repo: repo,
          cdn_github_branch: branch,
          cdn_upload_path: uploadPath,
          has_token: !!(token && token.length > 5),
          token_source: process.env.CDN_GITHUB_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_PAT ? 'vercel_env' : (dbConfig.cdn_github_token ? 'database' : 'none'),
          token_preview: token ? `${token.slice(0, 4)}...${token.slice(-4)}` : ''
        }
      }
    };
  }

  if (action === "save_cdn_config") {
    for (const [k, v] of Object.entries(bodyData)) {
      if (k.startsWith('cdn_')) {
        await runSql("INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [k, String(v || '')]).catch(async () => {
          await runSql("UPDATE system_settings SET value = ? WHERE key = ?", [String(v || ''), k]).catch(() => {});
        });
      }
    }
    return { status: 200, json: { ok: true } };
  }

  if (action === "list" || action === "cdn_list" || action === "cdn_gallery" || action === "get_cdn_gallery") {
    const rows = await runSql("SELECT * FROM cdn_gallery ORDER BY id DESC").catch(() => []);
    return { status: 200, json: { ok: true, gallery: rows || [], items: rows || [] } };
  }

  if (action === "add_direct_image" || action === "cdn_add_url") {
    const directUrl = (bodyData.url || bodyData.direct_url || req.query?.url || '').trim();
    const filename = (bodyData.filename || bodyData.name || `image_${Date.now()}.webp`).trim();
    const label = bodyData.size_label || bodyData.label || 'direct_url';

    if (!directUrl || !directUrl.startsWith('http')) {
      return { status: 400, json: { ok: false, error: "A valid image URL starting with http:// or https:// is required." } };
    }

    await runSql(`
      INSERT INTO cdn_gallery (filename, direct_url, size_label, original_kb, compressed_kb)
      VALUES (?, ?, ?, 0, 0)
    `, [filename, directUrl, label]);

    return { status: 200, json: { ok: true, direct_url: directUrl, item: { filename, direct_url: directUrl, size_label: label } } };
  }

  if (action === "upload" || action === "cdn_upload") {
    const { filename, targetSize, originalKb, compressedKb, base64Data, direct_url } = bodyData;
    
    // If direct URL is passed without base64
    if (direct_url && !base64Data) {
      const cleanFilename = (filename || `image_${Date.now()}.webp`).trim();
      await runSql(`
        INSERT INTO cdn_gallery (filename, direct_url, size_label, original_kb, compressed_kb)
        VALUES (?, ?, ?, ?, ?)
      `, [cleanFilename, direct_url, targetSize || 'direct_url', Number(originalKb) || 0, Number(compressedKb) || 0]);
      return { status: 200, json: { ok: true, direct_url, item: { filename: cleanFilename, direct_url, size_label: targetSize } } };
    }

    const configRows = await runSql("SELECT key, value FROM system_settings WHERE key LIKE 'cdn_%'").catch(() => []);
    const dbConfig = {};
    (configRows || []).forEach(r => { dbConfig[r.key] = r.value; });

    const { owner, repo, branch, uploadPath } = resolveCdnConfig(dbConfig);
    const token = resolveGitHubToken(dbConfig, bodyData);

    const cleanFilename = (filename || `image_${Date.now()}.webp`).trim().replace(/[^a-zA-Z0-9._-]/g, '_');
    const normPath = uploadPath ? uploadPath.replace(/^\/+|\/+$/g, '') : '';
    const filePath = normPath ? `${normPath}/${cleanFilename}` : cleanFilename;
    const directUrl = `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${filePath}`;

    if (base64Data) {
      if (!token) {
        return {
          status: 400,
          json: {
            ok: false,
            error: "GitHub Personal Access Token is required to upload images to GitHub CDN repository. Please enter your GitHub token in CDN Settings."
          }
        };
      }

      const githubApiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}`;
      const base64Content = base64Data.includes('base64,') ? base64Data.split('base64,')[1] : base64Data;

      const authHeader = token.startsWith('Bearer ') || token.startsWith('token ')
        ? token
        : (token.startsWith('github_pat_') ? `Bearer ${token}` : `token ${token}`);

      let sha = null;
      try {
        const checkRes = await fetch(`${githubApiUrl}?ref=${encodeURIComponent(branch)}`, {
          headers: {
            'Authorization': authHeader,
            'User-Agent': 'TCRP-CDN-Uploader',
            'Accept': 'application/vnd.github+json'
          }
        });
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          sha = checkData.sha;
        }
      } catch (_) {}

      const commitPayload = {
        message: `Upload CDN asset ${cleanFilename} via TCRP Media Gallery`,
        content: base64Content,
        branch: branch,
        committer: {
          name: 'TCRP Gallery Hub',
          email: 'gallery@timelesscreations.ph'
        }
      };
      if (sha) commitPayload.sha = sha;

      const commitRes = await fetch(githubApiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': authHeader,
          'User-Agent': 'TCRP-CDN-Uploader',
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(commitPayload)
      });

      if (!commitRes.ok) {
        const errJson = await commitRes.json().catch(() => ({}));
        const errMsg = errJson.message || commitRes.statusText || 'Unknown GitHub API error';
        return {
          status: 500,
          json: {
            ok: false,
            error: `GitHub Commit Failed (${commitRes.status}): ${errMsg}. Please verify repository (${owner}/${repo}), branch (${branch}), and token permissions.`
          }
        };
      }
    }

    await runSql(`
      INSERT INTO cdn_gallery (filename, direct_url, size_label, original_kb, compressed_kb)
      VALUES (?, ?, ?, ?, ?)
    `, [cleanFilename, directUrl, targetSize || 'square_600', Number(originalKb) || 0, Number(compressedKb) || 0]);

    return {
      status: 200,
      json: {
        ok: true,
        direct_url: directUrl,
        item: { filename: cleanFilename, direct_url: directUrl, size_label: targetSize }
      }
    };
  }

  if (action === "delete" || action === "cdn_delete") {
    const id = Number(bodyData.id || req.query?.id);
    await runSql("DELETE FROM cdn_gallery WHERE id = ?", [id]).catch(() => {});
    return { status: 200, json: { ok: true } };
  }

  return null;
}
