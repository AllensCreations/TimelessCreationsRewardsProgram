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
    
    // ----------------------------------------------------
    // MISSIONARY PUSHER & BATCH IMPORTER
    // ----------------------------------------------------
    if (action === "push_missionaries" || req.url.includes("/api/push-missionaries")) {
      if (req.method === "GET") {
        const history = await runSql(
          "SELECT name, email, cohort, batch_month, created_at FROM missionaries ORDER BY is_prelisted DESC, rowid DESC LIMIT 30"
        );
        return res.status(200).json({ ok: true, history: history || [] });
      }

      const entries = bodyData.entries || req.body?.entries || [];
      if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ ok: false, error: "No entries provided" });
      }

      let added = 0;
      let skipped = 0;

      for (const item of entries) {
        const email = (item.email || "").trim().toLowerCase();
        const titleName = (item.title_name || item.name || "").trim();
        const firstName = (item.first_name || "").trim();
        const batchMonth = (item.batch || item.batch_month || "August 2026").trim();

        if (!email || !titleName) {
          skipped++;
          continue;
        }

        const isSister = titleName.toLowerCase().startsWith("sister") || (item.cohort || "").toLowerCase() === "sister";
        const cohort = isSister ? "sister" : "elder";
        const maxMonths = isSister ? 18 : 24;

        try {
          await runSql(`
            INSERT INTO missionaries (email, name, first_name, cohort, batch_month, max_months, is_prelisted, status, points)
            VALUES (?, ?, ?, ?, ?, ?, 1, active, 0)
            ON CONFLICT(email) DO UPDATE SET
              name = excluded.name,
              first_name = excluded.first_name,
              cohort = excluded.cohort,
              batch_month = excluded.batch_month,
              max_months = excluded.max_months,
              status = active
          `, [email, titleName, firstName, cohort, batchMonth, maxMonths]);
          added++;
        } catch (e) {
          skipped++;
        }
      }

      return res.status(200).json({
        ok: true,
        added,
        skipped,
        message: `Successfully processed ${added} records into Turso (${skipped} skipped/errors).`
      });
    }

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

    
    // ----------------------------------------------------
    // BATCH PUSHER
    // ----------------------------------------------------
    if (action === "push_missionaries") {
      if (req.method === "GET") {
        try {
          const logs = await runSql("SELECT email, name, last_name, cohort, batch_month FROM missionaries WHERE is_prelisted = 1 ORDER BY ROWID DESC LIMIT 50");
          return res.status(200).json({ ok: true, history: logs || [] });
        } catch (err) {
          return res.status(500).json({ ok: false, error: err.message });
        }
      }

      if (req.method === "POST") {
        const entries = bodyData.entries || [];
        if (!Array.isArray(entries) || entries.length === 0) {
          return res.status(400).json({ ok: false, error: "No entries provided" });
        }

        let added = 0, skipped = 0;
        for (const item of entries) {
          const email = (item.email || "").toLowerCase().trim();
          const titleName = (item.title_name || item.name || "").trim();
          const firstName = (item.first_name || "").trim();
          const batchMonth = (item.batch || "August 2026").trim();

          if (!email || !titleName) { skipped++; continue; }

          let cohort = "elder";
          let maxMonths = 24;
          if (/^sister\b/i.test(titleName)) { cohort = "sister"; maxMonths = 18; }

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
              "INSERT INTO missionaries (email, name, last_name, first_name, full_name, cohort, batch_month, referral_code, max_months, points, status, is_prelisted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, "active", 1)",
              [email, titleName, lastName, firstName, fullName, cohort, batchMonth, refCode, maxMonths]
            );
            added++;
          } catch (err) { skipped++; }
        }
        return res.status(200).json({ ok: true, added, skipped, message: `Successfully Saved/Updated: ${added}` });
      }
    }

    // ----------------------------------------------------
    // TEST EMAIL DISPATCHER
    // ----------------------------------------------------
    if (action === "test_email") {
      try {
        const email = req.query?.email || bodyData.email;
        if (!email) return res.status(400).json({ ok: false, error: "Missing email address parameter" });
        
        const { sendDripEmail } = await import("../lib/mailer.js");
        const success = await sendDripEmail(
          email, 
          1, 
          "System Diagnostic", 
          "This is an automated test from your Command Center.", 
          "Your API routes and SMTP connections are live and functioning properly."
        );
        
        if (success) return res.status(200).json({ ok: true, message: "Test email dispatched successfully." });
        return res.status(500).json({ ok: false, error: "SMTP accepted request but mailer failed to dispatch." });
      } catch (err) {
        return res.status(500).json({ ok: false, error: "Mailer error: " + err.message });
      }
    }

    return res.status(404).json({ ok: false, error: `Unknown action '${action}'` });
  } catch (err) {
    console.error("API Router Error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
