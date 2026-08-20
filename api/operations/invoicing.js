import crypto from 'crypto';
import { queryTurso, unwrap } from '../../lib/db.js';
import { logSystemEvent } from '../../lib/logger.js';

const BREVO_KEY = (process.env.BREVO_API_KEY || '').trim();

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

// Background table migrations & schema optimizations
async function ensureTablesBackground() {
  try {
    await runSql(`
      CREATE TABLE IF NOT EXISTS cash_invoices (
        invoice_id TEXT PRIMARY KEY,
        email TEXT,
        name TEXT,
        phone TEXT,
        items_json TEXT,
        subtotal REAL DEFAULT 0,
        discount_type TEXT DEFAULT 'fixed',
        discount_val REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        total_amount REAL DEFAULT 0,
        status TEXT DEFAULT 'COMPLETED',
        created_at TEXT
      );
    `);
    await runSql(`
      CREATE TABLE IF NOT EXISTS product_catalog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        price REAL DEFAULT 0
      );
    `);
    // Ensure 'verified' column exists in missionaries
    try { await runSql("ALTER TABLE missionaries ADD COLUMN verified INTEGER DEFAULT 0;"); } catch(e){}
  } catch (e) {
    console.error("Migration background error:", e.message);
  }
}

export default async function handler(req, res) {
  ensureTablesBackground();

  if (req.method === 'GET') {
    try {
      const [missionaries, invoices, products, logs] = await Promise.all([
        runSql("SELECT email, name, last_name, batch_month, verified FROM missionaries ORDER BY name ASC"),
        runSql("SELECT * FROM cash_invoices ORDER BY ROWID DESC"),
        runSql("SELECT name, price FROM product_catalog ORDER BY id ASC"),
        runSql("SELECT * FROM system_logs ORDER BY ROWID DESC LIMIT 100")
      ]);
      return res.status(200).json({ ok: true, missionaries, invoices, products, logs });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  if (req.method === 'POST') {
    const { action } = req.body || {};

    if (action === 'save_products') {
      const { products = [] } = req.body;
      await runSql("DELETE FROM product_catalog");
      for (const p of products) {
        if (p.name) {
          await runSql("INSERT INTO product_catalog (name, price) VALUES (?, ?)", [p.name.trim(), Number(p.price) || 0]);
        }
      }
      return res.status(200).json({ ok: true });
    }

    if (action === 'verify_missionary') {
      const { email } = req.body;
      await runSql("UPDATE missionaries SET verified = 1 WHERE email = ?", [email]);
      // Auto-delete row from session table upon verification as requested
      await runSql("DELETE FROM sessions WHERE temp_email = ?", [email]);
      return res.status(200).json({ ok: true });
    }

    if (action === 'create_invoice') {
      const { email, name, phone, items, subtotal, discountType, discountVal, discountAmount, totalAmount } = req.body;
      const invoiceId = 'INV-' + crypto.randomBytes(3).toString('hex').toUpperCase();
      const nowIso = new Date().toISOString();
      const itemsJson = JSON.stringify(items);

      await runSql(`
        INSERT INTO cash_invoices (invoice_id, email, name, phone, items_json, subtotal, discount_type, discount_val, discount_amount, total_amount, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?)
      `, [invoiceId, email || 'Walk-in / Cash', name, phone || '', itemsJson, subtotal, discountType, discountVal, discountAmount, totalAmount, nowIso]);

      return res.status(200).json({ ok: true, invoiceId });
    }

    if (action === 'delete_invoice') {
      const { invoice_id } = req.body;
      await runSql("DELETE FROM cash_invoices WHERE invoice_id = ?", [invoice_id]);
      return res.status(200).json({ ok: true });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
