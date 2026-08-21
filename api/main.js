import 'dotenv/config';
import { runSql } from '../lib/db.js';
import { sendDripEmail } from '../lib/mailer.js';

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
      try { bodyData = JSON.parse(req.body); } catch (e) { bodyData = {}; }
    } else {
      bodyData = req.body || {};
    }
    if (bodyData.action) action = bodyData.action;
  }

  try {
    // ----------------------------------------------------
    // TEST EMAIL ROUTE
    // ----------------------------------------------------
    if (action === "test_email") {
      const email = req.query?.email || bodyData.email;
      if (!email) {
        return res.status(400).json({ ok: false, error: "Missing email address parameter" });
      }

      try {
        const success = await sendDripEmail(
          email.trim(),
          1,
          "System Diagnostic",
          "This is an automated test from your Command Center.",
          "Your API routes and SMTP connections are live and functioning properly."
        );

        if (success) {
          return res.status(200).json({ ok: true, message: "Test email dispatched successfully." });
        }
        return res.status(500).json({ ok: false, error: "Mailer dispatch returned failure." });
      } catch (err) {
        return res.status(500).json({ ok: false, error: "Mailer error: " + err.message });
      }
    }

    // ----------------------------------------------------
    // BATCH PUSHER
    // ----------------------------------------------------
    if (action === "push_missionaries") {
      if (req.method === "GET") {
        const logs = await runSql("SELECT email, name, last_name, cohort, batch_month FROM missionaries WHERE is_prelisted = 1 ORDER BY ROWID DESC LIMIT 50");
        return res.status(200).json({ ok: true, history: logs || [] });
      }

      if (req.method === "POST") {
        const entries = bodyData.entries || [];
        if (!Array.isArray(entries) || entries.length === 0) {
          return res.status(400).json({ ok: false, error: "No entries provided" });
        }

        let added = 0;
        let skipped = 0;

        for (const item of entries) {
          const email = (item.email || "").toLowerCase().trim();
          const titleName = (item.title_name || item.name || "").trim();
          const firstName = (item.first_name || "").trim();
          const batchMonth = (item.batch || "August 2026").trim();

          if (!email || !titleName) { skipped++; continue; }

          let cohort = "elder";
          let maxMonths = 24;
          if (/^sister\b/i.test(titleName)) {
            cohort = "sister";
            maxMonths = 18;
          }

          const lastName = titleName.replace(/^(elder|sister)\s+/i, "").trim();
          const fullName = `${titleName} ${firstName}`.trim();

          try {
            const existing = (await runSql("SELECT email FROM missionaries WHERE LOWER(email) = ?", [email]))[0];
            if (existing) {
              await runSql(
                "UPDATE missionaries SET name = ?, last_name = ?, first_name = ?, full_name = ?, cohort = ?, batch_month = ?, max_months = ?, is_prelisted = 1 WHERE LOWER(email) = ?",
                [titleName, lastName, firstName, fullName, cohort, batchMonth, maxMonths, email]
              );
              added++;
              continue;
            }

            const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
            const nums = "23456789";
            let refCode = "";
            for (let i = 0; i < 3; i++) {
              refCode += chars.charAt(Math.floor(Math.random() * chars.length));
              refCode += nums.charAt(Math.floor(Math.random() * nums.length));
            }

            await runSql(
              "INSERT INTO missionaries (email, name, last_name, first_name, full_name, cohort, batch_month, referral_code, max_months, points, status, is_prelisted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', 1)",
              [email, titleName, lastName, firstName, fullName, cohort, batchMonth, refCode, maxMonths]
            );
            added++;
          } catch (err) {
            skipped++;
          }
        }

        return res.status(200).json({ ok: true, added, skipped, message: `Successfully Saved/Updated: ${added}` });
      }
    }

    // ----------------------------------------------------
    // DASHBOARD STATS
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
    // PRODUCT CATALOG
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
    // ORDERS & CLAIMS
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
    // DRIPS
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
    // INVOICES & CASH
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

    return res.status(404).json({ ok: false, error: `Unknown action '${action}'` });
  } catch (err) {
    console.error("API Router Error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
