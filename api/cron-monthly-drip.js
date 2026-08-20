import fs from 'fs';
import path from 'path';
import { queryTurso, unwrap } from '../lib/db.js';
import { logSystemEvent } from '../lib/logger.js';

const BREVO_KEY = (process.env.BREVO_API_KEY || '').trim();
const BATCH_SIZE = 30;
const DAILY_SEND_CEILING = 280;

const DEFAULTS = {
  temple: "https://lh3.googleusercontent.com/u/0/d/1IkagW3wWhIhfaG01mBL4wNF-1j2lP6YG",
  titleProd1: "Wooden Nametag",
  prod1: "https://lh3.googleusercontent.com/u/0/d/1F7Yb0OzuCmPO2LyZ0cMoaTM4d4rs5RFE",
  titleProd2: "POS Kit",
  prod2: "https://lh3.googleusercontent.com/u/0/d/101jY71PjxCwiuNznTgn7Xyc0HoXwB3WQ",
  gal1: "https://lh3.googleusercontent.com/u/0/d/1ZTR6vYPZu4jMmII6ZmxzIO2jD_Q2qZex",
  gal2: "https://lh3.googleusercontent.com/u/0/d/1x3BSmnhCH0MhEhmFKqfL3gctnljtY_Ky",
  gal3: "https://lh3.googleusercontent.com/u/0/d/1r6i_IK3P2oYjBLlI-ZiX2Vd7Rty2Phrv",
  gal4: "https://lh3.googleusercontent.com/u/0/d/1dRn6RIZd1Glv0kj3gduyO7TPJ3gbboeR",
  gal5: "https://lh3.googleusercontent.com/u/0/d/1PceqCmTOvYosSGb9h_tWiqk_qSIIZb4m",
  gal6: "https://lh3.googleusercontent.com/u/0/d/1FZ1hppzB5QWAAJRx5mdHUfFAwx9nMVqV"
};

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

function renderMonthlyTemplate(missionary, monthNum, media) {
  let template = "";
  try {
    const filePath = path.join(process.cwd(), 'templates', 'monthly-drip.html');
    if (fs.existsSync(filePath)) template = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(err.message);
  }

  if (!template) template = `<div><h2>Month {{month}}</h2><p>{{Msg}}</p></div>`;

  const fullName = missionary.name || "Elder Missionary";
  const nameParts = fullName.split(' ');
  const Suffix = nameParts[0] || 'Elder';
  const lastName = nameParts.slice(1).join(' ') || fullName;
  const DisplayDate = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const Msg = missionary.custom_msg || `Congratulations on serving faithfully for ${monthNum} month(s)! Your dedication brings light and hope to many lives across the Philippines.`;
  const MsgAuthor = missionary.quote || `"Trust in the Lord with all thine heart; and lean not unto thine own understanding."`;
  const Author = missionary.theme || `Proverbs 3:5`;

  let highlightHtml = "";
  if (media && media.active && media.image_url) {
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

  const m = media || {};

  return template
    .replace(/{{DisplayDate}}/g, DisplayDate)
    .replace(/{{Suffix}}/g, Suffix)
    .replace(/{{lastName}}/g, lastName)
    .replace(/{{Msg}}/g, Msg)
    .replace(/{{MsgAuthor}}/g, MsgAuthor)
    .replace(/{{Author}}/g, Author)
    .replace(/{{month}}/g, String(monthNum))
    .replace(/{{Points}}/g, String(missionary.points || 0))
    .replace(/{{points}}/g, String(missionary.points || 0))
    .replace(/{{referral_code}}/g, missionary.referral_code || 'TCRP')
    .replace(/{{ImgTemple}}/g, DEFAULTS.temple)
    .replace(/{{TitleProd1}}/g, m.title_prod1 || DEFAULTS.titleProd1)
    .replace(/{{ImgProd1}}/g, m.img_prod1 || DEFAULTS.prod1)
    .replace(/{{TitleProd2}}/g, m.title_prod2 || DEFAULTS.titleProd2)
    .replace(/{{ImgProd2}}/g, m.img_prod2 || DEFAULTS.prod2)
    .replace(/{{Gal1}}/g, m.gal1 || DEFAULTS.gal1)
    .replace(/{{Gal2}}/g, m.gal2 || DEFAULTS.gal2)
    .replace(/{{Gal3}}/g, m.gal3 || DEFAULTS.gal3)
    .replace(/{{Gal4}}/g, m.gal4 || DEFAULTS.gal4)
    .replace(/{{Gal5}}/g, m.gal5 || DEFAULTS.gal5)
    .replace(/{{Gal6}}/g, m.gal6 || DEFAULTS.gal6)
    .replace(/{{HighlightSection}}/g, highlightHtml);
}

async function sendBrevoEmail(recipientEmail, recipientName, subject, html) {
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
        sender: { name: "Timeless Creations", email: "noreply.timelesscreations.ph@gmail.com" },
        to: [{ email: recipientEmail, name: recipientName }],
        subject: subject,
        htmlContent: html
      })
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}

export default async function handler(req, res) {
  const now = new Date();
  const todayDateStr = now.toISOString().slice(0, 10);
  const nowIso = now.toISOString();

  await runSql(`
    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Check if Master Pause is active
  const stopRec = (await runSql("SELECT value FROM system_config WHERE key = 'force_stop'"))[0];
  if (stopRec?.value === '1') {
    return res.status(200).json({ ok: true, message: "Automated dispatch paused via Control Room switch." });
  }

  const dailyKey = `drip_count_${todayDateStr}`;
  const record = (await runSql("SELECT value FROM system_config WHERE key = ?", [dailyKey]))[0];
  let sentToday = record ? parseInt(record.value, 10) || 0 : 0;

  if (sentToday >= DAILY_SEND_CEILING) {
    return res.status(200).json({ ok: true, message: "Daily send quota reached." });
  }

  const allowedThisRun = Math.min(BATCH_SIZE, DAILY_SEND_CEILING - sentToday);

  const eligibleMissionaries = await runSql(`
    SELECT email, name, points, referral_code, months_sent, max_months, last_sent_at, next_send_date, cohort
    FROM missionaries
    WHERE status = 'active'
      AND (months_sent < max_months OR max_months IS NULL)
      AND (next_send_date IS NULL OR next_send_date <= ?)
    LIMIT ?
  `, [nowIso, allowedThisRun]);

  if (eligibleMissionaries.length === 0) {
    return res.status(200).json({ ok: true, message: "No missionaries due for drip." });
  }

  const mediaRecord = (await runSql("SELECT * FROM product_highlight WHERE id = 1"))[0] || null;

  let sentCount = 0;
  let failedCount = 0;

  for (const m of eligibleMissionaries) {
    const currentMonthNum = (m.months_sent || 0) + 1;
    const msgRecord = (await runSql("SELECT * FROM drip_messages WHERE month = ?", [currentMonthNum]))[0] || {};
    m.custom_msg = msgRecord.message;
    m.quote = msgRecord.scripture;
    m.theme = msgRecord.theme;

    const subject = `Timeless Creations: Month ${currentMonthNum} Missionary Inspiration`;
    const htmlContent = renderMonthlyTemplate(m, currentMonthNum, mediaRecord);

    const isSuccess = await sendBrevoEmail(m.email, m.name || "Missionary", subject, htmlContent);

    if (isSuccess) {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 30);
      const nextDateIso = nextDate.toISOString();

      await runSql(`
        UPDATE missionaries
        SET months_sent = months_sent + 1,
            last_sent_at = ?,
            next_send_date = ?
        WHERE email = ?
      `, [nowIso, nextDateIso, m.email]);

      sentCount++;
      sentToday++;
    } else {
      failedCount++;
    }
  }

  await runSql("INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)", [dailyKey, String(sentToday)]);
  await logSystemEvent('INFO', `Daily Drip: Sent ${sentCount} (Total today: ${sentToday}/${DAILY_SEND_CEILING})`);

  return res.status(200).json({
    ok: true,
    batch_sent: sentCount,
    batch_failed: failedCount,
    total_sent_today: sentToday
  });
}
