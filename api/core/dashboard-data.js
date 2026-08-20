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
    return false;
  }
}

async function ensureDripMessages() {
  await runSql(`
    CREATE TABLE IF NOT EXISTS drip_messages (
      month INTEGER PRIMARY KEY,
      theme TEXT,
      scripture TEXT,
      message TEXT,
      highlight_img TEXT,
      highlight_label TEXT
    );
  `);

  const countRow = (await runSql("SELECT COUNT(*) as c FROM drip_messages"))[0];
  if (!countRow || Number(countRow.c) === 0) {
    for (let m = 1; m <= 24; m++) {
      await runSql(`
        INSERT OR IGNORE INTO drip_messages (month, theme, scripture, message, highlight_img, highlight_label)
        VALUES (?, ?, ?, ?, '', '')
      `, [
        m,
        `Month ${m} Focus`,
        `"Trust in the Lord with all thine heart; and lean not unto thine own understanding." — Proverbs 3:5`,
        `Congratulations on serving faithfully for ${m} month(s)! Your dedication brings light and hope to many lives across the Philippines.`
      ]);
    }
  }
}

export default async function handler(req, res) {
  await ensureDripMessages();

  if (req.method === 'GET') {
    try {
      const missionaries = await runSql("SELECT * FROM missionaries ORDER BY ROWID DESC");
      const messages = await runSql("SELECT * FROM drip_messages ORDER BY month ASC");

      const todayStr = new Date().toISOString().slice(0, 10);
      const emailsToday = (await runSql("SELECT COUNT(*) as c FROM system_logs WHERE timestamp LIKE ? AND message LIKE '%sent%'", [`${todayStr}%`]))[0]?.c || 0;
      
      const monthPrefix = todayStr.slice(0, 7);
      const emailsThisMonth = (await runSql("SELECT COUNT(*) as c FROM system_logs WHERE timestamp LIKE ? AND message LIKE '%sent%'", [`${monthPrefix}%`]))[0]?.c || 0;

      const dailyStatsRows = await runSql(`
        SELECT substr(timestamp, 1, 10) as log_date, count(*) as count 
        FROM system_logs 
        WHERE (message LIKE '%Drip%' OR message LIKE '%sent%')
        GROUP BY substr(timestamp, 1, 10)
      `);
      
      const dailyStats = {};
      dailyStatsRows.forEach(r => {
        if (r.log_date) dailyStats[r.log_date] = r.count;
      });

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
          limit: m.max_months || 24,
          next_send_date: m.next_send_date
        })),
        messages: messages.map(msg => ({
          month: msg.month,
          theme: msg.theme,
          quote: msg.scripture,
          msg: msg.message,
          highlight_img: msg.highlight_img,
          highlight_label: msg.highlight_label
        })),
        emailsToday,
        emailsThisMonth,
        dailyStats
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const { action } = body;

    // Test Mode Dispenser Handler
    if (action === 'test_send') {
      const { email, mode = 'monthly' } = body;
      if (!email || !email.includes('@')) {
        return res.status(400).json({ ok: false, error: "Invalid recipient email address." });
      }

      let successCount = 0;
      const options = { month: 'long', year: 'numeric' };
      const DisplayDate = new Date().toLocaleDateString('en-US', options);

      // Load active media assets from Turso
      const media = (await runSql("SELECT * FROM product_highlight WHERE id = 1"))[0] || {};

      let highlightHtml = "";
      if (media.active && media.image_url) {
        highlightHtml = `
          <div style="background:#ffffff;border:1px solid #e0d6bc;padding:18px;margin:24px 0;text-align:center;">
            <span style="background:#8b1a1a;color:#fff;font-family:'Helvetica',Arial,sans-serif;font-size:9px;padding:4px 10px;letter-spacing:1.5px;text-transform:uppercase;display:inline-block;margin-bottom:12px;">⭐ Highlight Product of the Month</span>
            <h3 style="margin:0 0 12px 0;font-size:16px;color:#1a1a1a;text-transform:uppercase;letter-spacing:1px;">${media.title || 'Featured Missionary Item'}</h3>
            <div style="width:100%;max-width:240px;margin:0 auto 14px auto;">
              <img src="${media.image_url}" alt="Product Highlight" style="width:100%;aspect-ratio:1/1;object-fit:cover;border:1px solid #d4c197;border-radius:4px;display:block;">
            </div>
            <p style="font-size:13px;color:#555;margin:0 0 14px 0;">${media.description || ''}</p>
            <a href="https://m.me/TimelesscreationsRP" style="display:inline-block;padding:12px 24px;background-color:#1a1a1a;color:#d4c197!important;text-decoration:none;font-family:'Helvetica',Arial,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:2px;font-weight:bold;">Claim / Inquire Now</a>
          </div>
        `;
      }

      if (mode === 'all' || mode === 'monthly') {
        const html = loadTemplate('monthly-drip.html', {
          DisplayDate,
          Suffix: "Elder",
          lastName: "Dela Cruz",
          Msg: "Congratulations on serving faithfully! Your dedication brings light and hope to many lives across your mission.",
          MsgAuthor: "“Trust in the Lord with all thine heart; and lean not unto thine own understanding.”",
          Author: "Proverbs 3:5",
          Points: "12",
          points: "12",
          referral_code: "TEST2026",
          ImgTemple: media.img_temple || "https://lh3.googleusercontent.com/u/0/d/1IkagW3wWhIhfaG01mBL4wNF-1j2lP6YG",
          TitleProd1: media.title_prod1 || "Wooden Nametag",
          ImgProd1: media.img_prod1 || "https://lh3.googleusercontent.com/u/0/d/1F7Yb0OzuCmPO2LyZ0cMoaTM4d4rs5RFE",
          TitleProd2: media.title_prod2 || "POS Kit",
          ImgProd2: media.img_prod2 || "https://lh3.googleusercontent.com/u/0/d/101jY71PjxCwiuNznTgn7Xyc0HoXwB3WQ",
          Gal1: media.gal1 || "https://lh3.googleusercontent.com/u/0/d/1ZTR6vYPZu4jMmII6ZmxzIO2jD_Q2qZex",
          Gal2: media.gal2 || "https://lh3.googleusercontent.com/u/0/d/1x3BSmnhCH0MhEhmFKqfL3gctnljtY_Ky",
          Gal3: media.gal3 || "https://lh3.googleusercontent.com/u/0/d/1r6i_IK3P2oYjBLlI-ZiX2Vd7Rty2Phrv",
          Gal4: media.gal4 || "https://lh3.googleusercontent.com/u/0/d/1dRn6RIZd1Glv0kj3gduyO7TPJ3gbboeR",
          Gal5: media.gal5 || "https://lh3.googleusercontent.com/u/0/d/1PceqCmTOvYosSGb9h_tWiqk_qSIIZb4m",
          Gal6: media.gal6 || "https://lh3.googleusercontent.com/u/0/d/1FZ1hppzB5QWAAJRx5mdHUfFAwx9nMVqV",
          HighlightSection: highlightHtml
        });
        if (await sendBrevoEmail(email, "Test Missionary", "🧪 TCRP Test: Monthly Drip Email", html)) successCount++;
      }

      if (mode === 'all' || mode === 'otp') {
        const html = loadTemplate('otp-email.html', { name: "Elder Dela Cruz", otp_code: "888999" });
        if (await sendBrevoEmail(email, "Test Missionary", "🧪 TCRP Test: OTP Verification", html)) successCount++;
      }

      if (mode === 'all' || mode === 'receipt') {
        const html = loadTemplate('receipt-email.html', { name: "Elder Dela Cruz", email, order_id: "TX-TEST", item: "Temple Keychain", cost: "6" });
        if (await sendBrevoEmail(email, "Test Missionary", "🧪 TCRP Test: Receipt", html)) successCount++;
      }

      await logSystemEvent('INFO', `Test Email Dispenser sent ${successCount} email(s) to ${email}`);

      return res.status(200).json({
        ok: true,
        message: `Successfully dispatched ${successCount} test email(s) to ${email}!`
      });
    }

    if (action === 'update_message') {
      const { month, theme, scripture, message } = body;
      await runSql(`
        INSERT INTO drip_messages (month, theme, scripture, message)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(month) DO UPDATE SET
          theme = excluded.theme,
          scripture = excluded.scripture,
          message = excluded.message;
      `, [month, theme || '', scripture || '', message || '']);
      return res.status(200).json({ ok: true, message: `Month ${month} updated in drip_messages successfully.` });
    }

    if (action === 'delete_missionary') {
      const { email } = body;
      await runSql("DELETE FROM missionaries WHERE email = ?", [email]);
      return res.status(200).json({ ok: true });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
