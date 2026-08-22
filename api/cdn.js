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

  // ----------------------------------------------------
  // ACTION: UPLOAD TO IMGBB & PERSIST IN TURSO
  // ----------------------------------------------------
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
          error: 'IMGBB_API_KEY is not configured in environment variables (.env / Vercel).' 
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

      // Convert KB strings to clean rounded integers for Turso compatibility
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

  // ----------------------------------------------------
  // ACTION: RETRIEVE STORED GALLERY FROM TURSO
  // ----------------------------------------------------
  if (action === 'list' || action === 'get_cdn_gallery') {
    try {
      const rows = await runSql('SELECT * FROM cdn_gallery ORDER BY id DESC LIMIT 200');
      const gallery = Array.isArray(rows) ? rows : (rows?.rows || []);
      return res.status(200).json({ ok: true, gallery });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Failed to fetch gallery from Turso: ' + err.message });
    }
  }

  // ----------------------------------------------------
  // ACTION: PURGE ASSET FROM TURSO
  // ----------------------------------------------------
  if (action === 'delete' || action === 'delete_cdn_image') {
    try {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ ok: false, error: 'Missing image ID to delete.' });

      await runSql('DELETE FROM cdn_gallery WHERE id = ?', [Math.round(Number(id))]);
      return res.status(200).json({ ok: true, message: 'Asset removed from Turso gallery store.' });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Delete failed: ' + err.message });
    }
  }

  return res.status(400).json({ ok: false, error: `Invalid action '${action}'.` });
}
