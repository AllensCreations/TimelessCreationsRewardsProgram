import { runSql } from '../db.js';
import { sendThankYouEmail, sendOrderStatusEmail, sendDeliveredEmail } from '../mailer.js';

async function generateNextTcId() {
  const rows = await runSql("SELECT invoice_id FROM cash_invoices WHERE invoice_id LIKE 'TC%' ORDER BY rowid DESC LIMIT 1");
  let nextNum = 100001;
  if (rows && rows.length > 0 && rows[0].invoice_id) {
    const match = rows[0].invoice_id.match(/TC(\d+)/i);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  } else {
    const countRows = await runSql("SELECT COUNT(*) as cnt FROM cash_invoices");
    nextNum = 100001 + Number(countRows?.[0]?.cnt || 0);
  }
  return `TC${String(nextNum).padStart(6, '0')}`;
}

export async function handleInvoiceAction(action, req, bodyData) {
  if (action === "get_invoices") {
    const invoices = await runSql("SELECT * FROM cash_invoices ORDER BY created_at DESC LIMIT 100");
    return { status: 200, json: { ok: true, invoices: invoices || [] } };
  }

  if (action === "get_next_invoice_id") {
    const nextId = await generateNextTcId();
    return { status: 200, json: { ok: true, next_id: nextId } };
  }

  if (action === "update_invoice_status") {
    const { invoice_id, status } = bodyData;
    const cleanStatus = (status || 'PENDING').toUpperCase();
    await runSql("UPDATE cash_invoices SET status = ? WHERE invoice_id = ?", [cleanStatus, invoice_id]);
    
    const inv = (await runSql("SELECT * FROM cash_invoices WHERE invoice_id = ?", [invoice_id]))[0];
    if (inv && inv.email) {
      let itemsList = "Custom Order";
      try {
        const parsed = JSON.parse(inv.items_json);
        itemsList = parsed.map(i => `${i.qty}x ${i.name}`).join(', ');
      } catch(_) {}

      if (cleanStatus === 'DELIVERED') {
        await sendDeliveredEmail(inv.email, { name: inv.name, order_id: inv.invoice_id, item: itemsList, status: 'DELIVERED' });
      } else if (cleanStatus === 'PAID' || cleanStatus === 'COMPLETED') {
        await sendThankYouEmail(inv.email, { name: inv.name, order_id: inv.invoice_id, item: itemsList });
      } else {
        await sendOrderStatusEmail(inv.email, { name: inv.name, order_id: inv.invoice_id, item: itemsList }, cleanStatus);
      }
    }
    return { status: 200, json: { ok: true } };
  }

  if (action === "update_invoice") {
    const { invoice_id, name, email, items_json, subtotal, discount_type, discount_val, discount_amount, total_amount, status } = bodyData;
    const cleanStatus = (status || 'PENDING').toUpperCase();
    await runSql(`
      UPDATE cash_invoices 
      SET name = COALESCE(?, name), email = COALESCE(?, email), items_json = ?, subtotal = COALESCE(?, subtotal), discount_type = COALESCE(?, discount_type), discount_val = COALESCE(?, discount_val), discount_amount = COALESCE(?, discount_amount), total_amount = COALESCE(?, total_amount), status = ?
      WHERE invoice_id = ?
    `, [name, email, JSON.stringify(items_json || []), subtotal, discount_type, discount_val, discount_amount, total_amount, cleanStatus, invoice_id]);
    return { status: 200, json: { ok: true } };
  }

  if (action === "delete_invoice") {
    const { invoice_id } = bodyData;
    await runSql("DELETE FROM cash_invoices WHERE invoice_id = ?", [invoice_id]);
    return { status: 200, json: { ok: true } };
  }

  if (action === "create_invoice") {
    let { invoice_id, email, name, items_json, subtotal, discount_type, discount_val, discount_amount, total_amount } = bodyData;
    if (!invoice_id || !invoice_id.startsWith('TC')) {
      invoice_id = await generateNextTcId();
    }
    await runSql(`
      INSERT INTO cash_invoices (invoice_id, email, name, items_json, subtotal, discount_type, discount_val, discount_amount, total_amount, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP)
    `, [invoice_id, email, name, JSON.stringify(items_json || []), subtotal, discount_type, discount_val, discount_amount, total_amount]);
    return { status: 200, json: { ok: true, invoice_id } };
  }

  return null;
}
