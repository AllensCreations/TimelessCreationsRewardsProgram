import { runSql } from '../db.js';
import { sendThankYouEmail, sendOrderStatusEmail, sendDeliveredEmail } from '../mailer.js';

export async function handleCatalogAction(action, req, bodyData) {
  if (action === "get_products") {
    const typeFilter = req.query?.type || bodyData.type;
    let query = "SELECT id, name, CAST(price AS INTEGER) as price, image_url, type FROM product_catalog";
    let params = [];
    if (typeFilter) {
      query += " WHERE type = ? ORDER BY price ASC";
      params.push(typeFilter);
    } else {
      query += " ORDER BY type ASC, price ASC";
    }
    const products = await runSql(query, params);
    return { status: 200, json: { ok: true, products: products || [] } };
  }

  if (action === "sync_catalog" || action === "save_products") {
    const products = bodyData.products || req.body?.products || [];
    const catalogType = bodyData.type || req.body?.type || "reward";

    await runSql("DELETE FROM product_catalog WHERE type = ?", [catalogType]);

    for (const item of products) {
      if (!item.name) continue;
      const cost = parseFloat(item.price) || 0;
      const img = item.image_url || "https://i.postimg.cc/FFdrCNqq/Untitled56-20260820115353.png";

      await runSql(
        "INSERT INTO product_catalog (name, price, image_url, type) VALUES (?, ?, ?, ?) ON CONFLICT(name) DO UPDATE SET price = excluded.price, image_url = excluded.image_url, type = excluded.type",
        [item.name.trim(), cost, img, catalogType]
      );
    }
    return { status: 200, json: { ok: true, message: `${catalogType} catalog synchronized successfully` } };
  }

  if (action === "get_orders") {
    const orders = await runSql("SELECT * FROM orders ORDER BY CASE WHEN UPPER(status) = 'PENDING' THEN 0 ELSE 1 END ASC, created_at ASC");
    return { status: 200, json: { ok: true, orders: orders || [] } };
  }

  if (action === "update_order_status") {
    const { order_id, status } = bodyData;
    const cleanStatus = (status || 'PENDING').toUpperCase();
    await runSql("UPDATE orders SET status = ? WHERE order_id = ?", [cleanStatus, order_id]);
    
    const order = (await runSql("SELECT * FROM orders WHERE order_id = ?", [order_id]))[0];
    if (order && order.email) {
      if (cleanStatus === 'DELIVERED') {
        await sendDeliveredEmail(order.email, { name: order.name, order_id: order.order_id, item: order.item, status: 'DELIVERED' });
      } else if (cleanStatus === 'PAID' || cleanStatus === 'COMPLETED') {
        await sendThankYouEmail(order.email, { name: order.name, order_id: order.order_id, item: order.item });
      } else {
        await sendOrderStatusEmail(order.email, { name: order.name, order_id: order.order_id, item: order.item }, cleanStatus);
      }
    }
    return { status: 200, json: { ok: true } };
  }

  if (action === "update_order") {
    const { order_id, name, email, items_json, points_cost, status } = bodyData;
    const cleanStatus = (status || 'PENDING').toUpperCase();
    const itemsList = Array.isArray(items_json) ? items_json.map(i => `${i.qty}x ${i.name}`).join(', ') : '';
    
    await runSql(`
      UPDATE orders 
      SET name = COALESCE(?, name), email = COALESCE(?, email), items_json = ?, item = ?, points_cost = COALESCE(?, points_cost), status = ?
      WHERE order_id = ?
    `, [name, email, JSON.stringify(items_json || []), itemsList, points_cost, cleanStatus, order_id]);

    const order = (await runSql("SELECT * FROM orders WHERE order_id = ?", [order_id]))[0];
    if (order && order.email) {
      if (cleanStatus === 'DELIVERED') {
        await sendDeliveredEmail(order.email, { name: order.name, order_id: order.order_id, item: order.item, status: 'DELIVERED' });
      } else if (cleanStatus === 'PAID' || cleanStatus === 'COMPLETED') {
        await sendThankYouEmail(order.email, { name: order.name, order_id: order.order_id, item: order.item });
      } else {
        await sendOrderStatusEmail(order.email, { name: order.name, order_id: order.order_id, item: order.item }, cleanStatus);
      }
    }
    return { status: 200, json: { ok: true } };
  }

  if (action === "delete_order") {
    const { order_id } = bodyData;
    await runSql("DELETE FROM orders WHERE order_id = ?", [order_id]);
    return { status: 200, json: { ok: true } };
  }

  return null;
}
