import 'dotenv/config';
import { runSql } from '../lib/db.js';
import { sendDripEmail, sendOTPEmail, sendEmail } from '../lib/mailer.js';

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
    // TEST EMAIL ROUTE (WITH TEMPLATE SELECTOR)
    // ----------------------------------------------------
    if (action === "test_email") {
      const email = (req.query?.email || bodyData.email || "").trim();
      const templateType = req.query?.template_type || bodyData.template_type || "drip";

      if (!email) return res.status(400).json({ ok: false, error: "Missing target email address" });

      let success = false;
      if (templateType === "otp") {
        success = await sendOTPEmail(email, "749281");
      } else if (templateType === "receipt") {
        const receiptHtml = `
          <div style="font-family:Georgia,serif; padding:24px; color:#2c221e; max-width:440px; margin:0 auto; border:2px solid #c9a84c; background:#fffcf5; border-radius:10px; text-align:center;">
            <h2 style="color:#8b1a1a; margin-bottom:4px;">✨ Timeless Creations ✨</h2>
            <p style="font-size:11px; color:#8c7e5d; margin-bottom:16px;">TCRP Rewards Redemption Receipt</p>
            <div style="background:#ffffff; border:1px dashed #d4c197; padding:14px; text-align:left; font-size:12px; line-height:1.7;">
              <strong>Recipient:</strong> Elder / Sister Tester<br>
              <strong>Order Ref:</strong> TCRP-TEST-992<br>
              <strong>Item Claimed:</strong> Wooden Missionary Nametag<br>
              <strong>Points Cost:</strong> 6 PTS<br>
              <strong>Status:</strong> COMPLETED
            </div>
            <p style="font-size:11px; color:#8b1a1a; margin-top:14px; font-weight:bold;">💖 Thank you for your service! 🌸</p>
          </div>
        `;
        success = await sendEmail({
          to: email,
          subject: "Redemption Receipt • Timeless Creations Rewards",
          htmlContent: receiptHtml
        });
      } else {
        success = await sendDripEmail(
          email,
          1,
          "Faith & Devotion",
          "Trust in the Lord with all thine heart; and lean not unto thine own understanding.",
          "May your faith be strengthened as you serve and invite others to come unto Christ this month."
        );
      }

      if (success) return res.status(200).json({ ok: true, message: `${templateType.toUpperCase()} test email sent.` });
      return res.status(500).json({ ok: false, error: "Mailer dispatch returned failure." });
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
    // GET DASHBOARD STATS
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

    if (action === "get_orders") {
      const orders = await runSql("SELECT * FROM orders ORDER BY created_at DESC");
      return res.status(200).json({ ok: true, orders: orders || [] });
    }

    if (action === "get_drips") {
      const drips = await runSql("SELECT * FROM drip_messages ORDER BY month ASC");
      return res.status(200).json({ ok: true, drips: drips || [] });
    }

    if (action === "get_products") {
      const products = await runSql("SELECT * FROM product_catalog ORDER BY price ASC");
      return res.status(200).json({ ok: true, products: products || [] });
    }

    return res.status(404).json({ ok: false, error: `Unknown action '${action}'` });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
