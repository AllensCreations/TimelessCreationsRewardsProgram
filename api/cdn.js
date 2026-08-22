import crypto from 'crypto';
import { runSql } from '../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action || req.body?.action || (req.method === 'POST' ? 'upload' : 'list');

  // Initialize Turso cdn_gallery table
  try {
    await runSql(`
      CREATE TABLE IF NOT EXISTS cdn_gallery (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT,
        direct_url TEXT,
        size_label TEXT,
        original_kb INTEGER DEFAULT 0,
        compressed_kb INTEGER DEFAULT 0,
        delete_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    console.error('Turso CDN table init error:', err);
  }

  // ACTION: UPLOAD
  if (action === 'upload' || action === 'upload_cdn_image') {
    try {
      const { filename, base64Data, targetSize, originalKb, compressedKb } = req.body || {};
      if (!base64Data) {
        return res.status(400).json({ ok: false, error: 'Missing base64 image data.' });
      }

      const imgbbKey = process.env.IMGBB_API_KEY;
      if (!imgbbKey) {
        return res.status(500).json({ 
          ok: false, 
          error: 'IMGBB_API_KEY is not configured in .env / Vercel.' 
        });
      }

      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const hash = crypto.createHash('sha256').update((filename || 'img') + Date.now() + Math.random()).digest('hex').slice(0, 16);
      const uniqueFileName = `tcrp_${hash}`;

      const formData = new URLSearchParams();
      formData.append('image', cleanBase64);
      formData.append('name', uniqueFileName);

      const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
        body: formData
      });

      const imgbbData = await imgbbRes.json();

      if (!imgbbData.success) {
        return res.status(500).json({ 
          ok: false, 
          error: imgbbData.error?.message || 'ImgBB upload rejected.' 
        });
      }

      const directUrl = imgbbData.data.url;
      const deleteUrl = imgbbData.data.delete_url || '';
      const displayFileName = `${uniqueFileName}.webp`;

      const origKbInt = Math.round(Number(originalKb) || 0);
      const compKbInt = Math.round(Number(compressedKb) || 0);

      await runSql(
        'INSERT INTO cdn_gallery (filename, direct_url, size_label, original_kb, compressed_kb, delete_url) VALUES (?, ?, ?, ?, ?, ?)',
        [displayFileName, directUrl, targetSize || 'WebP 85%', origKbInt, compKbInt, deleteUrl]
      );

      const rows = await runSql('SELECT * FROM cdn_gallery WHERE filename = ? ORDER BY id DESC LIMIT 1', [displayFileName]);
      const itemRecord = (rows && rows[0]) ? rows[0] : {
        filename: displayFileName,
        direct_url: directUrl,
        size_label: targetSize || 'WebP 85%'
      };

      return res.status(200).json({
        ok: true,
        item: itemRecord,
        filename: displayFileName,
        direct_url: directUrl,
        size_label: targetSize || 'WebP 85%'
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'CDN Upload Failed: ' + err.message });
    }
  }

  // ACTION: LIST
  if (action === 'list' || action === 'get_cdn_gallery') {
    try {
      const rows = await runSql('SELECT * FROM cdn_gallery ORDER BY id DESC LIMIT 200');
      const gallery = Array.isArray(rows) ? rows : (rows?.rows || []);
      return res.status(200).json({ ok: true, gallery });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Failed to fetch gallery: ' + err.message });
    }
  }

  // ACTION: DELETE
  if (action === 'delete' || action === 'delete_cdn_image') {
    try {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ ok: false, error: 'Missing image ID.' });

      await runSql('DELETE FROM cdn_gallery WHERE id = ?', [Math.round(Number(id))]);
      return res.status(200).json({ ok: true, message: 'Asset removed from gallery.' });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Delete failed: ' + err.message });
    }
  }

  return res.status(400).json({ ok: false, error: 'Invalid action.' });
}
