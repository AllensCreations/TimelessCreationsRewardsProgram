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

export default async function handler(req, res) {
  await runSql(`
    CREATE TABLE IF NOT EXISTS product_catalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      price REAL DEFAULT 0
    );
  `);

  if (req.method === 'GET') {
    try {
      const catalog = await runSql("SELECT * FROM product_catalog ORDER BY price ASC");
      const orders = await runSql("SELECT * FROM orders WHERE status = 'PENDING' ORDER BY created_at DESC");
      return res.status(200).json({ ok: true, catalog, orders });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  if (req.method === 'POST') {
    const { action, name, price, order_id } = req.body || {};
    if (action === 'add_catalog') {
      await runSql("INSERT OR REPLACE INTO product_catalog (name, price) VALUES (?, ?)", [name, price]);
      return res.status(200).json({ ok: true });
    }
    if (action === 'fulfill_order') {
      await runSql("UPDATE orders SET status = 'FULFILLED' WHERE order_id = ?", [order_id]);
      return res.status(200).json({ ok: true });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
