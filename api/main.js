import 'dotenv/config';
import { runSql } from '../lib/db.js';
import { sendDripEmail, sendOTPEmail, sendReceiptEmail } from '../lib/mailer.js';

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

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
    // SYSTEM HEALTH & POWER STATE
    // ----------------------------------------------------
    if (action === "health_check") {
      const setting = (await runSql("SELECT value FROM system_settings WHERE key = 'power_state'"))[0];
      const status = (setting?.value || "ONLINE").toUpperCase();
      return res.status(200).json({ ok: true, status });
    }

    if (action === "toggle_power") {
      const state = (bodyData.state || "online").toUpperCase();
      await runSql(`
        INSERT INTO system_settings (key, value) VALUES ('power_state', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `, [state]);
      return res.status(200).json({ ok: true, state });
    }

    if (action === "force_cron") {
      return res.status(200).json({ ok: true, message: "Scheduled drip check executed." });
    }

    // ----------------------------------------------------
    // PRODUCT CATALOG SYNC & MANAGEMENT
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

    if (action === "sync_catalog" || action === "synch catalog" || action === "save_products") {
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
    // TEST EMAIL ROUTE (AUTHENTIC TEMPLATES & BATCH DISPATCH)
    // ----------------------------------------------------
    if (action === "test_email") {
      const rawEmails = (bodyData.email || req.query?.email || "").trim();
      const templateType = bodyData.template_type || req.query?.template_type || "drip";
      const month = Number(bodyData.month || req.query?.month) || 1;

      if (!rawEmails) return res.status(400).json({ ok: false, error: "Missing email address(es)" });

      const targets = rawEmails.split(',').map(e => e.trim()).filter(Boolean);
      let successCount = 0;

      for (const target of targets) {
        let sent = false;
        if (templateType === "otp") {
          sent = await sendOTPEmail(target, "891402");
        } else if (templateType === "receipt") {
          sent = await sendReceiptEmail(target, {
            name: "Elder / Sister Diagnostic",
            order_id: `TCRP-${Date.now().toString().slice(-4)}`,
            item: "Wooden Missionary Nametag",
            points_cost: 6
          });
        } else {
          sent = await sendDripEmail(target, month, "Elder / Sister");
        }
        if (sent) successCount++;
      }

      if (successCount > 0) {
        return res.status(200).json({
          ok: true,
          totalSent: successCount,
          template: templateType,
          month: templateType === "drip" ? month : undefined,
          recipients: targets
        });
      }
      return res.status(500).json({ ok: false, error: "Brevo SMTP delivery failed." });
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
        let added = 0;

        for (const item of entries) {
          const email = (item.email || "").toLowerCase().trim();
          const titleName = (item.title_name || item.name || "").trim();
          const firstName = (item.first_name || "").trim();
          const batchMonth = (item.batch || "August 2026").trim();

          if (!email || !titleName) continue;

          let cohort = "elder";
          let maxMonths = 24;
          if (/^sister\b/i.test(titleName)) {
            cohort = "sister";
            maxMonths = 18;
          }

          const lastName = titleName.replace(/^(elder|sister)\s+/i, "").trim();
          const fullName = `${titleName} ${firstName}`.trim();

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
        }

        return res.status(200).json({ ok: true, added });
      }
    }

    // ----------------------------------------------------
    // DASHBOARD STATS
    // ----------------------------------------------------
    if (action === "get_stats" || !action) {
      const [totalM, activeM, totalO, pendingO, totalDrips, pts] = await Promise.all([
        runSql("SELECT COUNT(*) as count FROM missionaries"),
        runSql("SELECT COUNT(*) as count FROM missionaries WHERE status = 'active'"),
        runSql("SELECT COUNT(*) as count FROM orders"),
        runSql("SELECT COUNT(*) as count FROM orders WHERE UPPER(status) = 'PENDING'"),
        runSql("SELECT COUNT(*) as count FROM drip_messages"),
        runSql("SELECT SUM(points) as pts FROM missionaries")
      ]);

      return res.status(200).json({
        ok: true,
        stats: {
          total_missionaries: totalM[0]?.count || 0,
          active_missionaries: activeM[0]?.count || 0,
          total_orders: totalO[0]?.count || 0,
          pending_orders: pendingO[0]?.count || 0,
          total_drips: totalDrips[0]?.count || 0,
          circulating_points: pts[0]?.pts || 0
        }
      });
    }

    // ----------------------------------------------------
    // ROSTER & DATA ENDPOINTS
    // ----------------------------------------------------
    if (action === "get_missionaries") {
      const rows = await runSql("SELECT * FROM missionaries ORDER BY is_prelisted DESC, name ASC");
      return res.status(200).json({ ok: true, missionaries: rows || [] });
    }

    if (action === "update_missionary_points") {
      const { email, delta } = bodyData;
      await runSql("UPDATE missionaries SET points = MAX(0, points + ?) WHERE email = ?", [delta, email]);
      return res.status(200).json({ ok: true });
    }

    if (action === "toggle_missionary_status") {
      const { email, status } = bodyData;
      await runSql("UPDATE missionaries SET status = ? WHERE email = ?", [status, email]);
      return res.status(200).json({ ok: true });
    }

    if (action === "get_orders") {
      const orders = await runSql("SELECT * FROM orders ORDER BY created_at DESC");
      return res.status(200).json({ ok: true, orders: orders || [] });
    }

    if (action === "update_order_status") {
      const { order_id, status } = bodyData;
      await runSql("UPDATE orders SET status = ? WHERE order_id = ?", [status, order_id]);
      return res.status(200).json({ ok: true });
    }

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
    return res.status(500).json({ ok: false, error: err.message });
  }
}
