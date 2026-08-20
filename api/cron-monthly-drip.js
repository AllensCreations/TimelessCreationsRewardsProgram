import fs from 'fs';
import path from 'path';
import { queryTurso, unwrap } from '../lib/db.js';
import { logSystemEvent } from '../lib/logger.js';

const BREVO_KEY = (process.env.BREVO_API_KEY || '').trim();
const BATCH_SIZE = 30;
const DAILY_SEND_CEILING = 280;

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

function renderMonthlyTemplate(missionary, monthNum, highlightRecord) {
  let template = "";
  try {
    const filePath = path.join(process.cwd(), 'templates', 'monthly-drip.html');
    if (fs.existsSync(filePath)) {
      template = fs.readFileSync(filePath, 'utf8');
    }
  } catch (err) {
    console.error(err.message);
  }

  if (!template) {
    template = `<div><h2>Month {{month}}</h2><p>{{Msg}}</p></div>`;
  }

  const fullName = missionary.name || "Elder Missionary";
  const nameParts = fullName.split(' ');
  const Suffix = nameParts[0] || 'Elder';
  const lastName = nameParts.slice(1).join(' ') || fullName;
  const DisplayDate = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const Msg = missionary.custom_msg || `Congratulations on serving faithfully for ${monthNum} month(s)! Your dedication brings light and hope to many lives across the Philippines.`;
  const MsgAuthor = missionary.quote || `"Trust in the Lord with all thine heart; and lean not unto thine own understanding."`;
  const Author = missionary.theme || `Proverbs 3:5`;

  // Build Highlight HTML if active image exists
  let highlightHtml = "";
  if (highlightRecord && highlightRecord.active && highlightRecord.image_url) {
    highlightHtml = `
      <div class="highlight-card">
        <span class="highlight-badge">⭐ Highlight Product of the Month</span>
        <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #1a1a1a; text-transform: uppercase; letter-spacing: 1px;">${highlightRecord.title || 'Featured Missionary Gear'}</h3>
        <img src="${highlightRecord.image_url}" alt="${highlightRecord.title || 'Highlight'}" style="width: 100%; max-width: 320px; aspect-ratio: 16/9; object-fit: cover; border: 1px solid #d4c197; border-radius: 4px; display: block; margin: 0 auto 12px auto;">
        <p style="font-size: 13px; color: #555; margin: 0 0 14px 0;">${highlightRecord.description || ''}</p>
        <a href="https://m.me/TimelesscreationsRP" class="cta-btn-gold">Claim / Inquire Now</a>
      </div>
    `;
  }

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

  // Fetch current active product highlight
  const hlRecord = (await runSql("SELECT * FROM product_highlight WHERE id = 1"))[0] || null;

  let sentCount = 0;
  let failedCount = 0;

  for (const m of eligibleMissionaries) {
    const currentMonthNum = (m.months_sent || 0) + 1;
    const msgRecord = (await runSql("SELECT * FROM messages WHERE month = ?", [currentMonthNum]))[0] || {};
    m.custom_msg = msgRecord.message;
    m.quote = msgRecord.scripture;
    m.theme = msgRecord.theme;

    const subject = `Timeless Creations: Month ${currentMonthNum} Missionary Inspiration`;
    const htmlContent = renderMonthlyTemplate(m, currentMonthNum, hlRecord);

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
