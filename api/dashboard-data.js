import fs from 'fs';
import path from 'path';
import { queryTurso, unwrap } from '../lib/db.js';
import { logSystemEvent } from '../lib/logger.js';

const BREVO_KEY = (process.env.BREVO_API_KEY || '').trim();
const SENDER_EMAIL = 'noreply.timelesscreations.ph@gmail.com';

async function runSql(sql, args = []) {
  const formattedArgs = args.map(val => {
    if (val === null || val === undefined) return { type: "null" };
    if (typeof val === "number") return { type: "integer", value: String(val) };
    return { type: "text", value: String(val) };
  });
  const data = await queryTurso([{ type: "execute", stmt: { sql, args: formattedArgs } }]);
  const results = data.results || [];
  const targetBatch = results[results.length - 2]?.response?.result || results[0]?.response?.result;
  if (!targetBatch || !targetBatch.cols) return [];
  const cols = targetBatch.cols.map(c => (typeof c === 'object' ? c.name : c));
  return (targetBatch.rows || []).map(row => {
    const obj = {};
    row.forEach((cell, idx) => { obj[cols[idx]] = unwrap(cell); });
    return obj;
  });
}

function loadTemplate(filename, replacements = {}) {
  try {
    const filePath = path.join(process.cwd(), 'templates', filename);
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      for (const [key, val] of Object.entries(replacements)) {
        content = content.replace(new RegExp(`{{${key}}}`, 'g'), val);
      }
      return content;
    }
  } catch (err) {
    console.error(`Failed to load template ${filename}:`, err.message);
  }
  return `<p>Template ${filename} missing.</p>`;
}

async function sendBrevoEmail(toEmail, toName, subject, htmlContent) {
  if (!BREVO_KEY) return false;
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: "Timeless Creations", email: SENDER_EMAIL },
        to: [{ email: toEmail, name: toName }],
        subject: subject,
        htmlContent: htmlContent
      })
    });
    return res.ok;
  } catch (err) {
    console.error("Brevo test send exception:", err.message);
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const missionaries = await runSql("SELECT * FROM missionaries ORDER BY ROWID DESC");
      const orders = await runSql("SELECT * FROM orders ORDER BY ROWID DESC");
      const messages = await runSql("SELECT * FROM messages ORDER BY month ASC");

      const todayStr = new Date().toISOString().slice(0, 10);
      const emailsToday = (await runSql("SELECT COUNT(*) as c FROM system_logs WHERE timestamp LIKE ? AND message LIKE '%sent%'", [`${todayStr}%`]))[0]?.c || 0;
      
      const monthPrefix = todayStr.slice(0, 7);
      const emailsThisMonth = (await runSql("SELECT COUNT(*) as c FROM system_logs WHERE timestamp LIKE ? AND message LIKE '%sent%'", [`${monthPrefix}%`]))[0]?.c || 0;

      return res.status(200).json({
        ok: true,
        missionaries: missionaries.map(m => ({
          name: m.name,
          email: m.email,
          cohort: m.cohort || 'elder',
          start: m.batch_month || 'August 2026',
          points: m.points || 0,
          ref: m.referral_code || 'TCRP',
          status: m.status || 'active',
          monthsDiff: m.months_sent || 0,
          limit: m.max_months || 24
        })),
        orders: orders.map(o => ({
          order_id: o.order_id,
          name: o.name,
          email: o.email,
          item: o.item,
          cost: o.points_cost,
          status: o.status || 'PENDING',
          date: o.created_at ? new Date(o.created_at).toLocaleDateString() : 'Just now'
        })),
        messages: messages.map(msg => ({
          month: msg.month,
          theme: msg.theme,
          quote: msg.scripture,
          msg: msg.message
        })),
        emailsToday,
        emailsThisMonth
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const { action } = body;

    // Multi-Drip Test Email Dispenser Handler
    if (action === 'test_send') {
      const { email, mode } = body;
      if (!email || !email.includes('@')) {
        return res.status(400).json({ ok: false, error: "Invalid recipient email address." });
      }

      let successCount = 0;
      const options = { month: 'long', year: 'numeric' };
      const DisplayDate = new Date().toLocaleDateString('en-US', options);

      if (mode === 'all' || mode === 'monthly') {
        const html = loadTemplate('monthly-drip.html', {
          DisplayDate,
          Suffix: "Elder",
          lastName: "Dela Cruz",
          Msg: "Congratulations on serving faithfully! Your dedication brings light and hope to many lives across your mission.",
          MsgAuthor: "“Trust in the Lord with all thine heart; and lean not unto thine own understanding.”",
          Author: "Proverbs 3:5",
          month: "1",
          points: "5",
          referral_code: "TEST99"
        });
        if (await sendBrevoEmail(email, "Test Missionary", "Test: Monthly Drip Template", html)) successCount++;
      }

      if (mode === 'all' || mode === 'otp') {
        const html = loadTemplate('otp-email.html', {
          name: "Elder Dela Cruz",
          otp_code: "888999"
        });
        if (await sendBrevoEmail(email, "Test Missionary", "Test: OTP Verification Template", html)) successCount++;
      }

      if (mode === 'all' || mode === 'receipt') {
        const html = loadTemplate('receipt-email.html', {
          name: "Elder Dela Cruz",
          email,
          order_id: "TX-TEST",
          item: "Temple Keychain",
          cost: "6"
        });
        if (await sendBrevoEmail(email, "Test Missionary", "Test: Receipt Template", html)) successCount++;
      }

      await logSystemEvent('INFO', `Test Email Dispenser dispatched ${successCount} test email(s) to ${email}`);

      return res.status(200).json({
        ok: true,
        message: `Successfully dispatched ${successCount} test email(s) using templates from templates/ folder!`
      });
    }

    if (action === 'update_points') {
      const { email, points } = body;
      await runSql("UPDATE missionaries SET points = ? WHERE email = ?", [points, email]);
      return res.status(200).json({ ok: true });
    }

    if (action === 'update_order_status') {
      const { order_id, status } = body;
      await runSql("UPDATE orders SET status = ? WHERE order_id = ?", [status, order_id]);
      return res.status(200).json({ ok: true });
    }

    if (action === 'delete_missionary') {
      const { email } = body;
      await runSql("DELETE FROM missionaries WHERE email = ?", [email]);
      return res.status(200).json({ ok: true });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
