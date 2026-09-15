import { runSql } from '../db.js';
import { sendThankYouEmail, sendOrderStatusEmail, sendDeliveredEmail } from '../mailer.js';
import { cache } from '../cache.js';

async function generateNextTcId() {
  const rows = await runSql("SELECT order_id as invoice_id FROM orders WHERE type = 'CASH' AND order_id LIKE 'TC%' ORDER BY rowid DESC LIMIT 1");
  let nextNum = 100001;
  if (rows && rows.length > 0 && rows[0].invoice_id) {
    const match = rows[0].invoice_id.match(/TC(\d+)/i);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  } else {
    const countRows = await runSql("SELECT COUNT(*) as cnt FROM orders WHERE type = 'CASH'");
    nextNum = 100001 + Number(countRows?.[0]?.cnt || 0);
  }
  return `TC${String(nextNum).padStart(6, '0')}`;
}

function isDeliveredLocked(deliveredAt, createdAt) {
  const tsStr = deliveredAt || createdAt;
  if (!tsStr) return false;
  const ts = new Date(tsStr).getTime();
  if (isNaN(ts)) return false;
  return (Date.now() - ts) >= (7 * 24 * 60 * 60 * 1000);
}

export async function handleInvoiceAction(action, req, bodyData) {
  if (action === "get_invoices") {
    const invoices = await cache.getOrSet("invoices_list", async () => {
      const res = await runSql("SELECT order_id as invoice_id, order_id, email, name, items_json, subtotal, discount_type, discount_val, discount_amount, total_amount, status, created_at, completed_at, delivered_at FROM orders WHERE type = 'CASH' ORDER BY created_at DESC LIMIT 100");
      return res || [];
    }, 20000, ["invoices", "orders"]);
    return { status: 200, json: { ok: true, invoices } };
  }

  if (action === "get_next_invoice_id") {
    const nextId = await generateNextTcId();
    return { status: 200, json: { ok: true, next_id: nextId } };
  }

  if (action === "update_invoice_status") {
    const { invoice_id, status } = bodyData;
    const cleanStatus = (status || 'PENDING').toUpperCase();

    const existing = (await runSql("SELECT order_id as invoice_id, * FROM orders WHERE type = 'CASH' AND order_id = ?", [invoice_id]))[0];
    if (existing && existing.status === 'DELIVERED' && cleanStatus !== 'DELIVERED' && isDeliveredLocked(existing.delivered_at, existing.created_at)) {
      return { status: 400, json: { ok: false, message: "Transaction was delivered over 7 days ago and is permanently locked." } };
    }

    if (cleanStatus === 'DELIVERED') {
      await runSql("UPDATE orders SET status = ?, delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP) WHERE type = 'CASH' AND order_id = ?", [cleanStatus, invoice_id]);
    } else {
      await runSql("UPDATE orders SET status = ? WHERE type = 'CASH' AND order_id = ?", [cleanStatus, invoice_id]);
    }
    
    const inv = (await runSql("SELECT order_id as invoice_id, * FROM orders WHERE type = 'CASH' AND order_id = ?", [invoice_id]))[0];
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
    cache.invalidateTag('invoices');
    cache.invalidateTag('orders');
    return { status: 200, json: { ok: true } };
  }

  if (action === "update_invoice") {
    const { invoice_id, name, email, items_json, subtotal, discount_type, discount_val, discount_amount, total_amount, status } = bodyData;
    const cleanStatus = (status || 'PENDING').toUpperCase();

    const existing = (await runSql("SELECT order_id as invoice_id, * FROM orders WHERE type = 'CASH' AND order_id = ?", [invoice_id]))[0];
    if (existing && existing.status === 'DELIVERED' && isDeliveredLocked(existing.delivered_at, existing.created_at)) {
      return { status: 400, json: { ok: false, message: "Transaction was delivered over 7 days ago and is permanently locked." } };
    }

    await runSql(`
      UPDATE orders 
      SET name = COALESCE(?, name), email = COALESCE(?, email), items_json = ?, subtotal = COALESCE(?, subtotal), discount_type = COALESCE(?, discount_type), discount_val = COALESCE(?, discount_val), discount_amount = COALESCE(?, discount_amount), total_amount = COALESCE(?, total_amount), status = ?
      WHERE type = 'CASH' AND order_id = ?
    `, [name, email, JSON.stringify(items_json || []), subtotal, discount_type, discount_val, discount_amount, total_amount, cleanStatus, invoice_id]);
    cache.invalidateTag('invoices');
    cache.invalidateTag('orders');
    return { status: 200, json: { ok: true } };
  }

  if (action === "delete_invoice") {
    const invoice_id = bodyData.invoice_id || req.query?.invoice_id;
    if (!invoice_id) return { status: 400, json: { ok: false, error: "Missing invoice_id" } };
    const existing = (await runSql("SELECT order_id as invoice_id, * FROM orders WHERE type = 'CASH' AND order_id = ?", [invoice_id]))[0];
    if (existing && existing.status === 'DELIVERED' && isDeliveredLocked(existing.delivered_at, existing.created_at)) {
      return { status: 400, json: { ok: false, message: "Transaction was delivered over 7 days ago and cannot be deleted." } };
    }
    await runSql("DELETE FROM orders WHERE type = 'CASH' AND order_id = ?", [invoice_id]);
    cache.invalidateTag('invoices');
    cache.invalidateTag('orders');
    return { status: 200, json: { ok: true } };
  }

  if (action === "create_invoice") {
    let { invoice_id, email, name, items_json, subtotal, discount_type, discount_val, discount_amount, total_amount } = bodyData;
    if (!invoice_id || !invoice_id.startsWith('TC')) {
      invoice_id = await generateNextTcId();
    }
    await runSql(`
      INSERT INTO orders (order_id, type, email, name, items_json, subtotal, discount_type, discount_val, discount_amount, total_amount, status, created_at)
      VALUES (?, 'CASH', ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP)
    `, [invoice_id, email, name, JSON.stringify(items_json || []), subtotal, discount_type, discount_val, discount_amount, total_amount]);
    cache.invalidateTag('invoices');
    cache.invalidateTag('orders');
    return { status: 200, json: { ok: true, invoice_id } };
  }

  return null;
}
