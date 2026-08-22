import crypto from 'crypto';
import { runSql } from '../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action || req.body?.action || (req.method === 'POST' ? 'upload' : 'list');

  // Ensure cdn_gallery table exists
  try {
    await runSql(`
      CREATE TABLE IF NOT EXISTS cdn_gallery (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT,
        direct_url TEXT,
        size_label TEXT,
        original_kb REAL DEFAULT 0,
        compressed_kb REAL DEFAULT 0,
        delete_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    console.error('CDN table init error:', err);
  }

  // ----------------------------------------------------
  // ACTION: UPLOAD & STORE IN CDN GALLERY
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
          error: 'IMGBB_API_KEY is not set in your environment (.env / Vercel).' 
        });
      }

      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const hash = crypto.createHash('sha256').update((filename || 'img') + Date.now() + Math.random()).digest('hex').slice(0, 16);
      const uniqueFileName = `tcrp_${hash}`;

      // Upload to ImgBB
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

      // Insert directly into the database store
      await runSql(
        'INSERT INTO cdn_gallery (filename, direct_url, size_label, original_kb, compressed_kb, delete_url) VALUES (?, ?, ?, ?, ?, ?)',
        [displayFileName, directUrl, targetSize || 'WebP 85%', originalKb || 0, compressedKb || 0, deleteUrl]
      );

      const itemRecord = (await runSql('SELECT * FROM cdn_gallery WHERE filename = ? ORDER BY id DESC LIMIT 1', [displayFileName]))[0];

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
  // ACTION: LIST ALL STORED GALLERY ASSETS
  // ----------------------------------------------------
  if (action === 'list' || action === 'get_cdn_gallery') {
    try {
      const gallery = await runSql('SELECT * FROM cdn_gallery ORDER BY id DESC LIMIT 150');
      return res.status(200).json({ ok: true, gallery });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Failed to fetch gallery: ' + err.message });
    }
  }

  // ----------------------------------------------------
  // ACTION: DELETE / PURGE IMAGE FROM STORE
  // ----------------------------------------------------
  if (action === 'delete' || action === 'delete_cdn_image') {
    try {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ ok: false, error: 'Missing image ID.' });

      await runSql('DELETE FROM cdn_gallery WHERE id = ?', [id]);
      return res.status(200).json({ ok: true, message: 'Asset removed from gallery.' });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Delete failed: ' + err.message });
    }
  }

  return res.status(400).json({ ok: false, error: 'Invalid action.' });
}
