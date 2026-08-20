import { queryTurso, unwrap } from '../lib/db.js';

async function runSql(sql, args = []) {
  const formattedArgs = args.map(val => {
    if (val === null || val === undefined) return { type: "null" };
    if (typeof val === "number") return { type: "integer", value: String(val) };
    return { type: "text", value: String(val) };
  });
  const data = await queryTurso([{ type: "execute", stmt: { sql, args: formattedArgs } }]);
  const results = data.results || [];
  const targetBatch = results[results.length - 2]?.response?.result || results[0]?.response?.result;
  if (!targetBatch || !targetBatch.cols) return [];
  const cols = targetBatch.cols.map(c => (typeof c === 'object' ? c.name : c));
  return (targetBatch.rows || []).map(row => {
    const obj = {};
    row.forEach((cell, idx) => { obj[cols[idx]] = unwrap(cell); });
    return obj;
  });
}

async function ensureTable() {
  await runSql(`
    CREATE TABLE IF NOT EXISTS product_highlight (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      title TEXT,
      description TEXT,
      image_url TEXT,
      active INTEGER DEFAULT 1,
      updated_at TEXT
    );
  `);
}

export default async function handler(req, res) {
  await ensureTable();

  if (req.method === 'GET') {
    try {
      const records = await runSql("SELECT * FROM product_highlight WHERE id = 1");
      return res.status(200).json({ ok: true, highlight: records[0] || null });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { title, description, image_url, active = 1 } = req.body || {};
      const nowIso = new Date().toISOString();

      await runSql(`
        INSERT INTO product_highlight (id, title, description, image_url, active, updated_at)
        VALUES (1, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          description = excluded.description,
          image_url = excluded.image_url,
          active = excluded.active,
          updated_at = excluded.updated_at;
      `, [title || '', description || '', image_url || '', active ? 1 : 0, nowIso]);

      return res.status(200).json({ ok: true, message: "Product highlight updated successfully!" });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
