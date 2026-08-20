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

// Non-blocking table initialization (runs in background)
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
  } catch (e) {
    console.error("Background table check error:", e.message);
  }
}

export default async function handler(req, res) {
  // Fire table checks in background without blocking request
  ensureTablesBackground();

  if (req.method === 'GET') {
    try {
      // Execute all 3 queries in parallel for lightning-fast response
      const [missionaries, invoices, products] = await Promise.all([
        runSql("SELECT email, name, last_name, cohort, batch_month FROM missionaries ORDER BY name ASC"),
        runSql("SELECT * FROM cash_invoices ORDER BY ROWID DESC"),
        runSql("SELECT name, price FROM product_catalog ORDER BY id ASC")
      ]);
      return res.status(200).json({ ok: true, missionaries, invoices, products });
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
      return res.status(200).json({ ok: true, message: "Product prices saved." });
    }

    if (action === 'create_invoice') {
      const { email, name, phone, items, subtotal, discountType, discountVal, discountAmount, totalAmount } = req.body;
      if (!name || !items || items.length === 0) {
        return res.status(400).json({ ok: false, error: "Missing name or items." });
      }

      const invoiceId = 'INV-' + crypto.randomBytes(3).toString('hex').toUpperCase();
      const nowIso = new Date().toISOString();
      const itemsJson = JSON.stringify(items);

      await runSql(`
        INSERT INTO cash_invoices (invoice_id, email, name, phone, items_json, subtotal, discount_type, discount_val, discount_amount, total_amount, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?)
      `, [invoiceId, email || 'Walk-in / Cash', name, phone || '', itemsJson, subtotal, discountType, discountVal, discountAmount, totalAmount, nowIso]);

      return res.status(200).json({ ok: true, invoiceId, message: `Invoice ${invoiceId} created successfully!` });
    }

    if (action === 'delete_invoice') {
      const { invoice_id } = req.body;
      await runSql("DELETE FROM cash_invoices WHERE invoice_id = ?", [invoice_id]);
      return res.status(200).json({ ok: true });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
