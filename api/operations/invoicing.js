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

async function ensureTables() {
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

  const count = (await runSql("SELECT COUNT(*) as c FROM product_catalog"))[0]?.c || 0;
  if (count === 0) {
    const defaults = [
      ["Temple Keychain", 150],
      ["Nametag Keychain", 250],
      ["Salvation Kit (POS)", 650],
      ["Scripture Case", 950],
      ["Custom Missionary Item", 100]
    ];
    for (const [name, price] of defaults) {
      await runSql("INSERT OR IGNORE INTO product_catalog (name, price) VALUES (?, ?)", [name, price]);
    }
  }
}

async function sendBrevoReceiptEmail(recipientEmail, recipientName, phone, invoiceData) {
  if (!BREVO_KEY || !recipientEmail || !recipientEmail.includes('@')) return false;
  try {
    const itemsListHtml = invoiceData.items.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>${item.name}</strong></td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.qty}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₱${Number(item.price).toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">₱${Number(item.subtotal).toFixed(2)}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; color: #222; border: 2px solid #c9a84c; border-radius: 12px; background: #ffffff;">
        <div style="text-align: center; border-bottom: 2px solid #f1e4cb; padding-bottom: 12px; margin-bottom: 16px;">
          <h1 style="color: #8b1a1a; margin: 0; font-size: 26px; letter-spacing: 2px;">INVOICE</h1>
          <p style="font-size: 13px; color: #b8955a; margin: 4px 0 0 0;">✨ Timeless Creations ✨</p>
        </div>

        <div style="font-size: 13px; line-height: 1.6; margin-bottom: 16px;">
          <div><strong>Invoice Ref:</strong> ${invoiceData.invoice_id}</div>
          <div><strong>Bill To:</strong> ${recipientName}</div>
          <div><strong>Email:</strong> ${recipientEmail}</div>
          <div><strong>Phone:</strong> ${phone || '—'}</div>
          <div><strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
          <thead>
            <tr style="background: #fdfaf3; color: #78716c;">
              <th style="padding: 8px; text-align: left;">Item</th>
              <th style="padding: 8px; text-align: center;">Qty</th>
              <th style="padding: 8px; text-align: right;">Price</th>
              <th style="padding: 8px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsListHtml}
          </tbody>
        </table>

        <div style="border-top: 1px solid #eee; padding-top: 10px; font-size: 13px; text-align: right;">
          <div>Subtotal: ₱${Number(invoiceData.subtotal).toFixed(2)}</div>
          <div style="color: #16a34a;">Discount: -₱${Number(invoiceData.discount_amount).toFixed(2)}</div>
          <div style="font-size: 16px; font-weight: bold; color: #8b1a1a; margin-top: 6px;">Total Paid: ₱${Number(invoiceData.total_amount).toFixed(2)}</div>
        </div>

        <div style="margin-top: 24px; text-align: center; font-size: 12px; color: #777;">
          <p style="font-weight: bold; color: #8b1a1a; margin-bottom: 4px;">💖 Thank you for supporting Timeless Creations! 🌸</p>
        </div>
      </div>
    `;

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: "Timeless Creations", email: "support@timelesscreationsrp.com" },
        to: [{ email: recipientEmail, name: recipientName }],
        subject: `Official Invoice & Receipt — ${invoiceData.invoice_id}`,
        htmlContent
      })
    });
    return res.ok;
  } catch (err) {
    console.error("Brevo receipt dispatch failed:", err.message);
    return false;
  }
}

export default async function handler(req, res) {
  await ensureTables();

  if (req.method === 'GET') {
    try {
      const missionaries = await runSql("SELECT email, name, last_name, cohort, batch_month FROM missionaries ORDER BY name ASC");
      const invoices = await runSql("SELECT * FROM cash_invoices ORDER BY ROWID DESC");
      const products = await runSql("SELECT name, price FROM product_catalog ORDER BY id ASC");
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
      return res.status(200).json({ ok: true, message: "Product prices saved to Turso database." });
    }

    if (action === 'create_invoice') {
      const { email, name, phone, items, subtotal, discountType, discountVal, discountAmount, totalAmount } = req.body;
      if (!name || !items || items.length === 0) {
        return res.status(400).json({ ok: false, error: "Missing customer name or items." });
      }

      const invoiceId = 'INV-' + crypto.randomBytes(3).toString('hex').toUpperCase();
      const nowIso = new Date().toISOString();
      const itemsJson = JSON.stringify(items);

      await runSql(`
        INSERT INTO cash_invoices (invoice_id, email, name, phone, items_json, subtotal, discount_type, discount_val, discount_amount, total_amount, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?)
      `, [invoiceId, email || 'Walk-in / Cash', name, phone || '', itemsJson, subtotal, discountType, discountVal, discountAmount, totalAmount, nowIso]);

      let emailSent = false;
      if (email && email.includes('@')) {
        emailSent = await sendBrevoReceiptEmail(email, name, phone, {
          invoice_id: invoiceId,
          items,
          subtotal,
          discount_amount: discountAmount,
          total_amount: totalAmount
        });
      }

      await logSystemEvent('INFO', `Invoice Generated: ${invoiceId} for ${name} - Total: ₱${totalAmount}`);

      return res.status(200).json({
        ok: true,
        invoiceId,
        emailSent,
        message: `Invoice ${invoiceId} generated successfully!`
      });
    }

    if (action === 'delete_invoice') {
      const { invoice_id } = req.body;
      await runSql("DELETE FROM cash_invoices WHERE invoice_id = ?", [invoice_id]);
      await logSystemEvent('INFO', `Invoice Deleted: ${invoice_id}`);
      return res.status(200).json({ ok: true, message: `Invoice ${invoice_id} deleted.` });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
