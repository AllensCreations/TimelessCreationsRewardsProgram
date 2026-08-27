import 'dotenv/config';
import { runSql } from '../lib/db.js';
import { sendDripEmail, sendOTPEmail, sendReceiptEmail, sendThankYouEmail } from '../lib/mailer.js';

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-admin-key");

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

  // Authorization Guard for Mutating Administrative Actions
  const SENSITIVE_ACTIONS = [
    "toggle_power", "delete_missionary", "update_missionary_points",
    "push_missionaries", "sync_catalog", "save_products",
    "save_drip", "update_order_status", "update_invoice_status",
    "create_invoice", "get_system_logs", "force_cron"
  ];

  if (SENSITIVE_ACTIONS.includes(action)) {
    const adminSecret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
    const authHeader = req.headers?.authorization || req.headers?.['x-admin-key'] || req.query?.admin_key || bodyData.admin_key;
    if (adminSecret && authHeader !== `Bearer ${adminSecret}` && authHeader !== adminSecret) {
      return res.status(401).json({ ok: false, error: "Unauthorized administrative request." });
    }
  }

  try {
    switch (action) {
      case "health_check":
      case "ping": {
        let status = "ONLINE";
        try {
          const setting = (await runSql("SELECT value FROM system_settings WHERE key = 'power_state'"))[0];
          status = (setting?.value || "ONLINE").toUpperCase();
        } catch (_) {}
        return res.status(200).json({ ok: status === "ONLINE", status, power_state: status });
      }

      case "toggle_power": {
        const state = (bodyData.state || "online").toUpperCase();
        await runSql(`
          INSERT INTO system_settings (key, value) VALUES ('power_state', ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `, [state]);
        await runSql("INSERT INTO system_logs (level, message) VALUES ('INFO', ?)", [`System power state switched to ${state}`]);
        return res.status(200).json({ ok: true, state });
      }

      case "get_system_logs": {
        const limit = Math.min(Number(req.query?.limit || bodyData.limit) || 150, 500);
        const rows = await runSql("SELECT id, level, message, created_at FROM system_logs ORDER BY id DESC LIMIT ?", [limit]);
        return res.status(200).json({ ok: true, logs: rows || [] });
      }

      case "update_missionary_points": {
        const email = (bodyData.email || "").toLowerCase().trim();
        const delta = Number(bodyData.delta) || 0;
        if (!email) return res.status(400).json({ ok: false, error: "Missing email address" });

        await runSql("UPDATE missionaries SET points = MAX(0, points + ?) WHERE LOWER(email) = ?", [delta, email]);
        await runSql("INSERT INTO system_logs (level, message) VALUES ('INFO', ?)", [`Updated points for ${email} by delta ${delta}`]);
        return res.status(200).json({ ok: true });
      }

      case "get_stats":
      default: {
        if (action && action !== "get_stats" && action !== undefined) {
          break;
        }
        const todayIso = new Date().toISOString().slice(0, 10);
        const monthIso = new Date().toISOString().slice(0, 7);

        const [
          totalM, activeM, totalO, pendingO, totalDrips, pts,
          recentOrders, recentLogs, todaySent, monthSent, recentlySent
        ] = await Promise.all([
          runSql("SELECT COUNT(*) as count FROM missionaries").catch(() => [{ count: 0 }]),
          runSql("SELECT COUNT(*) as count FROM missionaries WHERE status = 'active'").catch(() => [{ count: 0 }]),
          runSql("SELECT COUNT(*) as count FROM orders").catch(() => [{ count: 0 }]),
          runSql("SELECT COUNT(*) as count FROM orders WHERE UPPER(status) = 'PENDING'").catch(() => [{ count: 0 }]),
          runSql("SELECT COUNT(*) as count FROM drip_messages").catch(() => [{ count: 0 }]),
          runSql("SELECT SUM(points) as pts FROM missionaries").catch(() => [{ pts: 0 }]),
          runSql("SELECT order_id, name, item, points_cost, status, created_at FROM orders ORDER BY created_at DESC LIMIT 5").catch(() => []),
          runSql("SELECT id, level, message, created_at FROM system_logs ORDER BY id DESC LIMIT 50").catch(() => []),
          runSql("SELECT COUNT(*) as count FROM missionaries WHERE last_sent_at LIKE ?", [todayIso + "%"]).catch(() => [{ count: 0 }]),
          runSql("SELECT COUNT(*) as count FROM missionaries WHERE last_sent_at LIKE ?", [monthIso + "%"]).catch(() => [{ count: 0 }]),
          runSql("SELECT email, name, cohort, months_sent, last_sent_at FROM missionaries WHERE last_sent_at IS NOT NULL ORDER BY last_sent_at DESC LIMIT 8").catch(() => [])
        ]);

        return res.status(200).json({
          ok: true,
          stats: {
            total_missionaries: totalM[0]?.count || 0,
            active_missionaries: activeM[0]?.count || 0,
            total_orders: totalO[0]?.count || 0,
            pending_orders: pendingO[0]?.count || 0,
            total_drips: totalDrips[0]?.count || 0,
            circulating_points: pts[0]?.pts || 0,
            emails_today: todaySent[0]?.count || 0,
            emails_month: monthSent[0]?.count || 0
          },
          recent_orders: recentOrders || [],
          recent_logs: recentLogs || [],
          recently_sent_missionaries: recentlySent || [],
          daily_stats: { [todayIso]: todaySent[0]?.count || 0 }
        });
      }
    }

    if (action === "get_missionaries") {
      const rows = await runSql("SELECT * FROM missionaries ORDER BY is_prelisted DESC, name ASC");
      return res.status(200).json({ ok: true, missionaries: rows || [] });
    }

    if (action === "delete_missionary") {
      const email = (bodyData.email || req.query?.email || "").toLowerCase().trim();
      if (!email) return res.status(400).json({ ok: false, error: "Missing missionary email address" });

      const missionary = (await runSql("SELECT psid FROM missionaries WHERE LOWER(email) = ?", [email]))[0];
      if (missionary?.psid) {
        await runSql("DELETE FROM sessions WHERE psid = ?", [missionary.psid]);
      }
      await runSql("DELETE FROM missionaries WHERE LOWER(email) = ?", [email]);
      await runSql("INSERT INTO system_logs (level, message) VALUES ('WARN', ?)", [`Removed missionary ${email} from roster`]);

      return res.status(200).json({ ok: true, message: `Successfully deleted missionary ${email}` });
    }

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

        await runSql("INSERT INTO system_logs (level, message) VALUES ('INFO', ?)", [`Successfully bulk pushed ${added} missionaries`]);
        return res.status(200).json({ ok: true, added });
      }
    }

    if (action === "test_email") {
      const rawEmails = (bodyData.email || req.query?.email || "").trim();
      const templateType = bodyData.template_type || req.query?.template_type || "drip";
      const month = Number(bodyData.month || req.query?.month) || 1;

      if (!rawEmails) return res.status(400).json({ ok: false, error: "Missing email address(es)" });

      const targets = rawEmails.split(",").map(e => e.trim()).filter(Boolean);
      let successCount = 0;
      const results = [];

      for (const target of targets) {
        let dispatchResult;
        if (templateType === "otp") {
          dispatchResult = await sendOTPEmail(target, "891402");
        } else if (templateType === "receipt") {
          dispatchResult = await sendReceiptEmail(target, {
            name: "Elder / Sister Diagnostic",
            order_id: "TCRP-" + Date.now().toString().slice(-4),
            item: "Wooden Missionary Nametag",
            points_cost: 6
          });
        } else if (templateType === "thankyou") {
          dispatchResult = await sendThankYouEmail(target, {
            name: "Elder / Sister Diagnostic",
            order_id: "TCRP-" + Date.now().toString().slice(-4),
            item: "Wooden Missionary Nametag"
          });
        } else {
          dispatchResult = await sendDripEmail(target, month, "Elder / Sister");
        }

        results.push({ email: target, ...dispatchResult });
        if (dispatchResult?.ok) successCount++;
      }

      await runSql("INSERT INTO system_logs (level, message) VALUES ('INFO', ?)", [`Executed test email dispatch (${templateType}) to ${targets.join(', ')}`]);

      if (successCount > 0) {
        return res.status(200).json({
          ok: true,
          totalSent: successCount,
          template: templateType,
          month: templateType === "drip" ? month : undefined,
          recipients: targets,
          details: results
        });
      }

      return res.status(500).json({
        ok: false,
        error: "Brevo REST API rejected dispatch.",
        details: results
      });
    }

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
      return res.status(200).json({ ok: true, message: `${catalogType} catalog synchronized successfully` });
    }

    if (action === "get_orders") {
      const orders = await runSql("SELECT * FROM orders ORDER BY created_at DESC");
      return res.status(200).json({ ok: true, orders: orders || [] });
    }

    if (action === "update_order_status") {
      const { order_id, status } = bodyData;
      await runSql("UPDATE orders SET status = ? WHERE order_id = ?", [status, order_id]);
      
      if (status && status.toUpperCase() === 'COMPLETED') {
        const order = (await runSql("SELECT * FROM orders WHERE order_id = ?", [order_id]))[0];
        if (order && order.email) {
          await sendThankYouEmail(order.email, { name: order.name, order_id: order.order_id, item: order.item });
        }
      }
      return res.status(200).json({ ok: true });
    }

    if (action === "get_drips") {
      const drips = await runSql("SELECT * FROM drip_messages ORDER BY month ASC");
      const configRows = await runSql("SELECT key, value FROM system_config WHERE key LIKE 'drip_%_highlight_2'");
      const highlight2Map = {};
      (configRows || []).forEach(r => {
        try { highlight2Map[r.key] = JSON.parse(r.value); } catch(_) {}
      });

      const mergedDrips = (drips || []).map(d => {
        const extra = highlight2Map[`drip_${d.month}_highlight_2`];
        return {
          ...d,
          highlight_label_2: extra?.label || "",
          highlight_img_2: extra?.img || ""
        };
      });

      return res.status(200).json({ ok: true, drips: mergedDrips });
    }

    if (action === "save_drip") {
      const { month, subject, theme, scripture, message, highlight_img, highlight_label, highlight_img_2, highlight_label_2, custom_html } = bodyData;
      await runSql(`
        INSERT INTO drip_messages (month, subject, theme, scripture, message, highlight_img, highlight_label, custom_html)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(month) DO UPDATE SET
          subject = excluded.subject,
          theme = excluded.theme,
          scripture = excluded.scripture,
          message = excluded.message,
          highlight_img = excluded.highlight_img,
          highlight_label = excluded.highlight_label,
          custom_html = excluded.custom_html
      `, [
        Number(month) || 1,
        subject || "",
        theme || "",
        scripture || "",
        message || "",
        highlight_img || "",
        highlight_label || "",
        custom_html || ""
      ]);

      if (highlight_label_2) {
        const val = JSON.stringify({ label: highlight_label_2, img: highlight_img_2 || "" });
        await runSql("INSERT INTO system_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [`drip_${month}_highlight_2`, val]);
      } else {
        await runSql("DELETE FROM system_config WHERE key = ?", [`drip_${month}_highlight_2`]);
      }

      return res.status(200).json({ ok: true });
    }

    if (action === "get_invoices") {
      const invoices = await runSql("SELECT * FROM cash_invoices ORDER BY created_at DESC LIMIT 50");
      return res.status(200).json({ ok: true, invoices: invoices || [] });
    }

    if (action === "update_invoice_status") {
      const { invoice_id, status } = bodyData;
      await runSql("UPDATE cash_invoices SET status = ? WHERE invoice_id = ?", [status, invoice_id]);
      if (status && status.toUpperCase() === 'COMPLETED') {
        const inv = (await runSql("SELECT * FROM cash_invoices WHERE invoice_id = ?", [invoice_id]))[0];
        if (inv && inv.email) {
          let itemsList = "Custom Order";
          try {
            const parsed = JSON.parse(inv.items_json);
            itemsList = parsed.map(i => `${i.qty}x ${i.name}`).join(', ');
          } catch(_) {}
          await sendThankYouEmail(inv.email, { name: inv.name, order_id: inv.invoice_id, item: itemsList });
        }
      }
      return res.status(200).json({ ok: true });
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
    console.error(`API Error [${action}]:`, err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
