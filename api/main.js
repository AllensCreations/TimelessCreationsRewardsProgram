import 'dotenv/config';
import { runSql } from '../lib/db.js';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  let action = req.query?.action;
  let bodyData = {};

  if (req.body) {
    if (typeof req.body === "string") {
      try { bodyData = JSON.parse(req.body); } catch (e) {}
    } else {
      bodyData = req.body;
    }
    if (bodyData.action) action = bodyData.action;
  }

  try {
    // ----------------------------------------------------
    // DASHBOARD & STATS
    // ----------------------------------------------------
    if (action === "get_stats" || action === "get_dashboard" || !action) {
      const [
        totalMissionaries,
        activeMissionaries,
        totalOrders,
        pendingOrders,
        totalDrips,
        recentOrders,
        recentLogs
      ] = await Promise.all([
        runSql("SELECT COUNT(*) as count FROM missionaries"),
        runSql("SELECT COUNT(*) as count FROM missionaries WHERE status = 'active'"),
        runSql("SELECT COUNT(*) as count FROM orders"),
        runSql("SELECT COUNT(*) as count FROM orders WHERE UPPER(status) = 'PENDING'"),
        runSql("SELECT COUNT(*) as count FROM drip_messages"),
        runSql("SELECT order_id, name, item, points_cost, status, created_at FROM orders ORDER BY created_at DESC LIMIT 5"),
        runSql("SELECT id, level, message, created_at FROM system_logs ORDER BY id DESC LIMIT 6")
      ]);

      const totalPts = await runSql("SELECT SUM(points) as pts FROM missionaries");

      return res.status(200).json({
        ok: true,
        stats: {
          total_missionaries: totalMissionaries[0]?.count || 0,
          active_missionaries: activeMissionaries[0]?.count || 0,
          total_orders: totalOrders[0]?.count || 0,
          pending_orders: pendingOrders[0]?.count || 0,
          total_drips: totalDrips[0]?.count || 0,
          circulating_points: totalPts[0]?.pts || 0
        },
        recent_orders: recentOrders || [],
        recent_logs: recentLogs || []
      });
    }

    // ----------------------------------------------------
    // MISSIONARIES DIRECTORY
    // ----------------------------------------------------
    if (action === "get_missionaries") {
      const rows = await runSql("SELECT * FROM missionaries ORDER BY is_prelisted DESC, name ASC");
      return res.status(200).json({ ok: true, missionaries: rows || [] });
    }

    if (action === "update_missionary_points") {
      const { email, delta } = bodyData;
      if (!email || typeof delta !== 'number') return res.status(400).json({ ok: false, error: "Missing email or delta" });
      await runSql("UPDATE missionaries SET points = MAX(0, points + ?) WHERE email = ?", [delta, email]);
      return res.status(200).json({ ok: true });
    }

    if (action === "toggle_missionary_status") {
      const { email, status } = bodyData;
      await runSql("UPDATE missionaries SET status = ? WHERE email = ?", [status, email]);
      return res.status(200).json({ ok: true });
    }

    // ----------------------------------------------------
    // PRODUCT CATALOG (REWARD VS CASH ISOLATION)
    // ----------------------------------------------------
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
      return res.status(200).json({ ok: true, products: products || [] });
    }

    if (action === "sync_catalog") {
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
      return res.status(200).json({ ok: true, message: `${catalogType} catalog synchronized successfully` });
    }

    // ----------------------------------------------------
    // CLAIMS & ORDERS
    // ----------------------------------------------------
    if (action === "get_orders") {
      const orders = await runSql("SELECT * FROM orders ORDER BY created_at DESC");
      return res.status(200).json({ ok: true, orders: orders || [] });
    }

    if (action === "update_order_status") {
      const { order_id, status } = bodyData;
      await runSql("UPDATE orders SET status = ? WHERE order_id = ?", [status, order_id]);
      return res.status(200).json({ ok: true });
    }

    // ----------------------------------------------------
    // DRIP MESSAGES
    // ----------------------------------------------------
    if (action === "get_drips") {
      const drips = await runSql("SELECT * FROM drip_messages ORDER BY month ASC");
      return res.status(200).json({ ok: true, drips: drips || [] });
    }

    if (action === "save_drip") {
      const { month, theme, scripture, message, highlight_img, highlight_label } = bodyData;
      await runSql(`
        INSERT INTO drip_messages (month, theme, scripture, message, highlight_img, highlight_label)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(month) DO UPDATE SET
          theme = excluded.theme,
          scripture = excluded.scripture,
          message = excluded.message,
          highlight_img = excluded.highlight_img,
          highlight_label = excluded.highlight_label
      `, [month, theme, scripture, message, highlight_img || '', highlight_label || '']);
      return res.status(200).json({ ok: true });
    }

    // ----------------------------------------------------
    // CASH INVOICING / POS
    // ----------------------------------------------------
    if (action === "get_invoices") {
      const invoices = await runSql("SELECT * FROM cash_invoices ORDER BY created_at DESC LIMIT 50");
      return res.status(200).json({ ok: true, invoices: invoices || [] });
    }

    if (action === "create_invoice") {
      const { invoice_id, email, name, items_json, subtotal, discount_type, discount_val, discount_amount, total_amount } = bodyData;
      await runSql(`
        INSERT INTO cash_invoices (invoice_id, email, name, items_json, subtotal, discount_type, discount_val, discount_amount, total_amount, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP)
      `, [invoice_id, email, name, JSON.stringify(items_json || []), subtotal, discount_type, discount_val, discount_amount, total_amount]);
      return res.status(200).json({ ok: true });
    }

    // ----------------------------------------------------
    // SYSTEM SETTINGS
    // ----------------------------------------------------
    if (action === "get_settings") {
      const settings = await runSql("SELECT key, value FROM system_settings");
      const map = {};
      settings.forEach(s => { map[s.key] = s.value; });
      return res.status(200).json({ ok: true, settings: map });
    }

    return res.status(404).json({ ok: false, error: `Unknown action '${action}'` });
  } catch (err) {
    console.error("API Router Error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
