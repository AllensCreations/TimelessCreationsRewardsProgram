import { runSql } from '../db.js';
import { sendThankYouEmail, sendOrderStatusEmail } from '../mailer.js';

export async function handleInvoiceAction(action, req, bodyData) {
  if (action === "get_invoices") {
    const invoices = await runSql("SELECT * FROM cash_invoices ORDER BY created_at DESC LIMIT 50");
    return { status: 200, json: { ok: true, invoices: invoices || [] } };
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

      if (cleanStatus === 'PAID' || cleanStatus === 'COMPLETED') {
        await sendThankYouEmail(inv.email, { name: inv.name, order_id: inv.invoice_id, item: itemsList });
      } else {
        await sendOrderStatusEmail(inv.email, { name: inv.name, order_id: inv.invoice_id, item: itemsList }, cleanStatus);
      }
    }
    return { status: 200, json: { ok: true } };
  }

  if (action === "update_invoice") {
    const { invoice_id, items_json, subtotal, discount_type, discount_val, discount_amount, total_amount, status } = bodyData;
    const cleanStatus = (status || 'PENDING').toUpperCase();
    await runSql(`
      UPDATE cash_invoices 
      SET items_json = ?, subtotal = ?, discount_type = ?, discount_val = ?, discount_amount = ?, total_amount = ?, status = ?
      WHERE invoice_id = ?
    `, [JSON.stringify(items_json || []), subtotal, discount_type, discount_val, discount_amount, total_amount, cleanStatus, invoice_id]);
    return { status: 200, json: { ok: true } };
  }

  if (action === "delete_invoice") {
    const { invoice_id } = bodyData;
    await runSql("DELETE FROM cash_invoices WHERE invoice_id = ?", [invoice_id]);
    return { status: 200, json: { ok: true } };
  }

  if (action === "create_invoice") {
    const { invoice_id, email, name, items_json, subtotal, discount_type, discount_val, discount_amount, total_amount } = bodyData;
    await runSql(`
      INSERT INTO cash_invoices (invoice_id, email, name, items_json, subtotal, discount_type, discount_val, discount_amount, total_amount, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP)
    `, [invoice_id, email, name, JSON.stringify(items_json || []), subtotal, discount_type, discount_val, discount_amount, total_amount]);
    return { status: 200, json: { ok: true } };
  }

  return null;
}
