import crypto from 'crypto';
import { runSql } from '../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // If a file is requested via GET /api/cdn?file=tcrp_xxx.webp
  if (req.method === 'GET' && req.query.file) {
    const filename = req.query.file.replace(/[^a-zA-Z0-9_.-]/g, '');
    try {
      const repoOwner = process.env.GITHUB_OWNER || 'salviejo';
      const repoName = process.env.GITHUB_REPO || 'TimelessCreationsRewardsProgram';

      const ghUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/public/cdn/${filename}`;
      const ghRes = await fetch(ghUrl, {
        headers: {
          'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'TCRP-Media-Hub'
        }
      });

      if (!ghRes.ok) {
        return res.status(404).json({ ok: false, error: 'Image not found or GitHub token invalid.' });
      }

      const fileData = await ghRes.json();
      const imgBuffer = Buffer.from(fileData.content, 'base64');

      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(imgBuffer);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  const action = req.query.action || req.body?.action || (req.method === 'POST' ? 'upload' : 'list');

  // Ensure DB table exists
  try {
    await runSql(`
      CREATE TABLE IF NOT EXISTS cdn_gallery (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT,
        direct_url TEXT,
        size_label TEXT,
        original_kb REAL DEFAULT 0,
        compressed_kb REAL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    console.error('CDN table init error:', err);
  }

  // Upload action
  if (action === 'upload' || action === 'upload_cdn_image') {
    try {
      const { filename, base64Data, targetSize, originalKb, compressedKb } = req.body || {};
      if (!base64Data) {
        return res.status(400).json({ ok: false, error: 'Missing base64 image data.' });
      }

      const hash = crypto.createHash('sha256').update((filename || 'img') + Date.now() + Math.random()).digest('hex').slice(0, 16);
      const uniqueFileName = `tcrp_${hash}.webp`;

      const repoOwner = process.env.GITHUB_OWNER || 'salviejo';
      const repoName = process.env.GITHUB_REPO || 'TimelessCreationsRewardsProgram';
      const branch = 'main';

      if (process.env.GITHUB_TOKEN) {
        const ghUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/public/cdn/${uniqueFileName}`;
        const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');

        await fetch(ghUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'TCRP-Media-Hub'
          },
          body: JSON.stringify({
            message: `cdn: upload encrypted ${uniqueFileName}`,
            content: base64Content,
            branch
          })
        });
      }

      // Generate direct private-compatible URL via your own API route
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
      const directUrl = `${protocol}://${host}/api/cdn?file=${uniqueFileName}`;

      const insertRes = await runSql(
        'INSERT INTO cdn_gallery (filename, direct_url, size_label, original_kb, compressed_kb) VALUES (?, ?, ?, ?, ?) RETURNING id',
        [uniqueFileName, directUrl, targetSize || 'WebP 85%', originalKb || 0, compressedKb || 0]
      );

      return res.status(200).json({
        ok: true,
        id: insertRes[0]?.id,
        filename: uniqueFileName,
        direct_url: directUrl,
        size_label: targetSize || 'WebP 85%'
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'CDN Upload Failed: ' + err.message });
    }
  }

  // List action
  if (action === 'list' || action === 'get_cdn_gallery') {
    try {
      const gallery = await runSql('SELECT * FROM cdn_gallery ORDER BY id DESC LIMIT 100');
      return res.status(200).json({ ok: true, gallery });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Failed to fetch gallery: ' + err.message });
    }
  }

  // Delete action
  if (action === 'delete' || action === 'delete_cdn_image') {
    try {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ ok: false, error: 'Missing image ID to purge.' });

      await runSql('DELETE FROM cdn_gallery WHERE id = ?', [id]);
      return res.status(200).json({ ok: true, message: 'Asset removed from gallery index.' });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Delete failed: ' + err.message });
    }
  }

  return res.status(400).json({ ok: false, error: `Invalid action on CDN handler.` });
}
