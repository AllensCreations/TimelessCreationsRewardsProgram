import { runSql } from '../db.js';
import { sendThankYouEmail, sendOrderStatusEmail, sendDeliveredEmail } from '../mailer.js';
import { cache } from '../cache.js';

function isDeliveredLocked(deliveredAt, createdAt) {
  const tsStr = deliveredAt || createdAt;
  if (!tsStr) return false;
  const ts = new Date(tsStr).getTime();
  if (isNaN(ts)) return false;
  return (Date.now() - ts) >= (7 * 24 * 60 * 60 * 1000);
}

let serverMemoryDripRewardsVisible = true;

export async function resolveDripRewardsVisibility() {
  try {
    const row = await runSql("SELECT value FROM system_settings WHERE key = 'drip_rewards_visible'").catch(() => []);
    const val = row?.[0]?.value;
    if (val !== undefined && val !== null) {
      serverMemoryDripRewardsVisible = val !== 'false';
    }
  } catch (_) {}
  return serverMemoryDripRewardsVisible;
}

export async function persistDripRewardsVisibility(visible) {
  const isVisible = Boolean(visible);
  serverMemoryDripRewardsVisible = isVisible;
  const val = isVisible ? 'true' : 'false';
  try {
    await runSql(`
      INSERT INTO system_settings (key, value) VALUES ('drip_rewards_visible', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `, [val]).catch(async () => {
      await runSql("UPDATE system_settings SET value = ? WHERE key = 'drip_rewards_visible'", [val]).catch(() => {});
    });
  } catch (_) {}
  return isVisible;
}

export async function handleCatalogAction(action, req, bodyData) {
  if (action === "get_products") {
    const typeFilter = req.query?.type || bodyData.type;
    const cacheKey = `products_${typeFilter || 'all'}`;
    const products = await cache.getOrSet(cacheKey, async () => {
      let query = "SELECT id, name, CAST(price AS INTEGER) as price, image_url, type FROM product_catalog";
      let params = [];
      if (typeFilter) {
        query += " WHERE type = ? ORDER BY price ASC";
        params.push(typeFilter);
      } else {
        query += " ORDER BY type ASC, price ASC";
      }
      return (await runSql(query, params)) || [];
    }, 30000, ["catalog"]);
    const dripRewardsVisible = await resolveDripRewardsVisibility();
    return { status: 200, json: { ok: true, products, drip_rewards_visible: dripRewardsVisible } };
  }

  if (action === "get_drip_rewards_visibility" || action === "get_drip_rewards_category") {
    const visible = await resolveDripRewardsVisibility();
    return { status: 200, json: { ok: true, visible, drip_rewards_visible: visible } };
  }

  if (action === "set_drip_rewards_visibility" || action === "toggle_drip_rewards_category") {
    let reqVisible;
    if (bodyData.visible !== undefined) {
      reqVisible = Boolean(bodyData.visible);
    } else if (bodyData.drip_rewards_visible !== undefined) {
      reqVisible = Boolean(bodyData.drip_rewards_visible);
    } else if (req.query?.visible !== undefined) {
      reqVisible = req.query.visible === 'true';
    } else {
      const current = await resolveDripRewardsVisibility();
      reqVisible = !current;
    }
    const finalVisible = await persistDripRewardsVisibility(reqVisible);
    return { 
      status: 200, 
      json: { 
        ok: true, 
        visible: finalVisible, 
        drip_rewards_visible: finalVisible, 
        message: finalVisible ? "Reward category unhidden in Monthly Drip" : "Reward category hidden in Monthly Drip" 
      } 
    };
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

    if (bodyData.drip_rewards_visible !== undefined || req.body?.drip_rewards_visible !== undefined) {
      const isVisible = bodyData.drip_rewards_visible !== undefined ? Boolean(bodyData.drip_rewards_visible) : Boolean(req.body?.drip_rewards_visible);
      const val = isVisible ? 'true' : 'false';
      await runSql(`
        INSERT INTO system_settings (key, value) VALUES ('drip_rewards_visible', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `, [val]).catch(async () => {
        await runSql("UPDATE system_settings SET value = ? WHERE key = 'drip_rewards_visible'", [val]).catch(() => {});
      });
    }

    cache.invalidateTag("catalog");
    return { status: 200, json: { ok: true, message: `${catalogType} catalog synchronized successfully` } };
  }

  if (action === "get_orders") {
    const orders = await cache.getOrSet("orders_list", async () => {
      return (await runSql("SELECT * FROM orders ORDER BY CASE WHEN UPPER(status) = 'PENDING' THEN 0 ELSE 1 END ASC, created_at ASC")) || [];
    }, 20000, ["orders"]);
    return { status: 200, json: { ok: true, orders } };
  }

  if (action === "update_order_status") {
    const { order_id, status } = bodyData;
    const cleanStatus = (status || 'PENDING').toUpperCase();
    
    const existing = (await runSql("SELECT * FROM orders WHERE order_id = ?", [order_id]))[0];
    if (existing && existing.status === 'DELIVERED' && cleanStatus !== 'DELIVERED' && isDeliveredLocked(existing.delivered_at, existing.created_at)) {
      return { status: 400, json: { ok: false, message: "Transaction was delivered over 7 days ago and is permanently locked." } };
    }

    if (cleanStatus === 'DELIVERED') {
      await runSql("UPDATE orders SET status = ?, delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP) WHERE order_id = ?", [cleanStatus, order_id]);
    } else {
      await runSql("UPDATE orders SET status = ? WHERE order_id = ?", [cleanStatus, order_id]);
    }
    
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
    cache.invalidateTag("orders");
    return { status: 200, json: { ok: true } };
  }

  if (action === "update_order") {
    const { order_id, name, email, items_json, points_cost, status } = bodyData;
    const cleanStatus = (status || 'PENDING').toUpperCase();

    const existing = (await runSql("SELECT * FROM orders WHERE order_id = ?", [order_id]))[0];
    if (existing && existing.status === 'DELIVERED' && isDeliveredLocked(existing.delivered_at, existing.created_at)) {
      return { status: 400, json: { ok: false, message: "Transaction was delivered over 7 days ago and is permanently locked." } };
    }

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
    cache.invalidateTag("orders");
    return { status: 200, json: { ok: true } };
  }

  if (action === "delete_order") {
    const { order_id } = bodyData;
    const existing = (await runSql("SELECT * FROM orders WHERE order_id = ?", [order_id]))[0];
    if (existing && existing.status === 'DELIVERED' && isDeliveredLocked(existing.delivered_at, existing.created_at)) {
      return { status: 400, json: { ok: false, message: "Transaction was delivered over 7 days ago and cannot be deleted." } };
    }
    await runSql("DELETE FROM orders WHERE order_id = ?", [order_id]);
    cache.invalidateTag("orders");
    return { status: 200, json: { ok: true } };
  }

  return null;
}
