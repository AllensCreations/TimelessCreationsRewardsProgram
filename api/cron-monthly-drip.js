import fs from 'fs';
import path from 'path';
import { queryTurso, unwrap } from '../lib/db.js';
import { logSystemEvent } from '../lib/logger.js';

const BREVO_KEY = (process.env.BREVO_API_KEY || '').trim();
const BATCH_SIZE = 35; // Process 35 emails per run to stay well clear of timeouts

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

function renderMonthlyTemplate(missionary, monthNum) {
  let template = "";
  try {
    const filePath = path.join(process.cwd(), 'templates', 'monthly-drip.html');
    if (fs.existsSync(filePath)) {
      template = fs.readFileSync(filePath, 'utf8');
    }
  } catch (err) {
    console.error("Failed to read templates/monthly-drip.html:", err.message);
  }

  if (!template) {
    template = `<div style="padding:20px;"><h2>Month {{month}}</h2><p>{{Msg}}</p></div>`;
  }

  const fullName = missionary.name || "Elder Missionary";
  const nameParts = fullName.split(' ');
  const Suffix = nameParts[0] || 'Elder';
  const lastName = nameParts.slice(1).join(' ') || fullName;

  const options = { month: 'long', year: 'numeric' };
  const DisplayDate = new Date().toLocaleDateString('en-US', options);

  const Msg = missionary.custom_msg || `Congratulations on serving faithfully for ${monthNum} month(s)! Your dedication brings light and hope to many lives across the Philippines.`;
  const MsgAuthor = missionary.quote || `"Trust in the Lord with all thine heart; and lean not unto thine own understanding."`;
  const Author = missionary.theme || `Proverbs 3:5`;

  return template
    .replace(/{{DisplayDate}}/g, DisplayDate)
    .replace(/{{Suffix}}/g, Suffix)
    .replace(/{{lastName}}/g, lastName)
    .replace(/{{Msg}}/g, Msg)
    .replace(/{{MsgAuthor}}/g, MsgAuthor)
    .replace(/{{Author}}/g, Author)
    .replace(/{{month}}/g, String(monthNum))
    .replace(/{{points}}/g, String(missionary.points || 0))
    .replace(/{{referral_code}}/g, missionary.referral_code || 'TCRP');
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
    console.error(`Failed to send drip to ${recipientEmail}:`, err.message);
    return false;
  }
}

export const config = {
  maxDuration: 60 // Allow up to 60 seconds execution window for safety on Vercel
};

export default async function handler(req, res) {
  const now = new Date();
  const todayDateStr = now.toISOString().slice(0, 10); // e.g., '2026-08-19'
  const nowIso = now.toISOString();

  // Check if today's quota batch has already run and completed
  await runSql(`
    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  const lastRunRecord = (await runSql("SELECT value FROM system_config WHERE key = 'last_drip_date'"))[0];
  if (lastRunRecord && lastRunRecord.value === todayDateStr) {
    return res.status(200).json({
      ok: true,
      message: "Daily drip quota already completed for today. Execution skipped to protect quota limits."
    });
  }

  // Fetch only a safe chunk of eligible missionaries per run (e.g. 35 users)
  const eligibleMissionaries = await runSql(`
    SELECT email, name, points, referral_code, months_sent, max_months, last_sent_at, next_send_date
    FROM missionaries
    WHERE status = 'active'
      AND (months_sent < max_months OR max_months IS NULL)
      AND (next_send_date IS NULL OR next_send_date <= ?)
    LIMIT ?
  `, [nowIso, BATCH_SIZE]);

  if (eligibleMissionaries.length === 0) {
    // Mark today as fully completed since no more users need emails today
    await runSql("INSERT OR REPLACE INTO system_config (key, value) VALUES ('last_drip_date', ?)", [todayDateStr]);
    return res.status(200).json({ ok: true, message: "No more eligible missionaries to process today." });
  }

  let sentCount = 0;
  let failedCount = 0;

  for (const m of eligibleMissionaries) {
    const currentMonthNum = (m.months_sent || 0) + 1;
    const msgRecord = (await runSql("SELECT * FROM messages WHERE month = ?", [currentMonthNum]))[0] || {};
    m.custom_msg = msgRecord.message;
    m.quote = msgRecord.scripture;
    m.theme = msgRecord.theme;

    const subject = `Timeless Creations: Month ${currentMonthNum} Missionary Inspiration`;
    const htmlContent = renderMonthlyTemplate(m, currentMonthNum);

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
    } else {
      failedCount++;
    }
  }

  // Check if any remaining eligible missionaries are left for today
  const remainingCheck = (await runSql(`
    SELECT COUNT(*) as c FROM missionaries
    WHERE status = 'active'
      AND (months_sent < max_months OR max_months IS NULL)
      AND (next_send_date IS NULL OR next_send_date <= ?)
  `, [nowIso]))[0]?.c || 0;

  if (remainingCheck === 0) {
    // Lock execution for today so it doesn't run again until tomorrow
    await runSql("INSERT OR REPLACE INTO system_config (key, value) VALUES ('last_drip_date', ?)", [todayDateStr]);
  }

  await logSystemEvent('INFO', `Drip Chunk Executed: Sent ${sentCount}, Failed ${failedCount}. Remaining today: ${remainingCheck}`);

  return res.status(200).json({
    ok: true,
    batch_sent: sentCount,
    batch_failed: failedCount,
    remaining_in_queue: remainingCheck,
    daily_quota_locked: remainingCheck === 0
  });
}
