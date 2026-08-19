import fs from 'fs';
import path from 'path';
import { queryTurso, unwrap } from '../lib/db.js';
import { logSystemEvent } from '../lib/logger.js';

const BREVO_KEY = (process.env.BREVO_API_KEY || '').trim();

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

  // Fallback if file missing
  if (!template) {
    template = `<div style="padding:20px;"><h2>Month {{month}}</h2><p>{{Msg}}</p></div>`;
  }

  // Parse Name (e.g. "Elder Smith" -> Suffix: "Elder", lastName: "Smith")
  const fullName = missionary.name || "Elder Missionary";
  const nameParts = fullName.split(' ');
  const Suffix = nameParts[0] || 'Elder';
  const lastName = nameParts.slice(1).join(' ') || fullName;

  // Format Display Date (e.g., "August 2026")
  const options = { month: 'long', year: 'numeric' };
  const DisplayDate = new Date().toLocaleDateString('en-US', options);

  // Pull dynamic message & quote for the specific month from DB messages table if available
  // Fallback content if message not explicitly stored in messages table
  const Msg = missionary.custom_msg || `Congratulations on serving faithfully for ${monthNum} month(s)! Your dedication brings light and hope to many lives across the Philippines.`;
  const MsgAuthor = missionary.quote || `"Trust in the Lord with all thine heart; and lean not unto thine own understanding."`;
  const Author = missionary.theme || `Proverbs 3:5`;

  // Replace all placeholders
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
        sender: { name: "Timeless Creations", email: "support@timelesscreationsrp.com" },
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

export default async function handler(req, res) {
  const now = new Date();
  const nowIso = now.toISOString();

  const eligibleMissionaries = await runSql(`
    SELECT email, name, points, referral_code, months_sent, max_months, last_sent_at, next_send_date
    FROM missionaries
    WHERE status = 'active'
      AND (months_sent < max_months OR max_months IS NULL)
      AND (next_send_date IS NULL OR next_send_date <= ?)
  `, [nowIso]);

  let sentCount = 0;
  let failedCount = 0;

  for (const m of eligibleMissionaries) {
    const currentMonthNum = (m.months_sent || 0) + 1;
    
    // Also fetch message content for this specific month from DB messages table
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

  await logSystemEvent('INFO', `Monthly Drip Executed: ${sentCount} sent, ${failedCount} failed.`);

  return res.status(200).json({
    ok: true,
    sent: sentCount,
    failed: failedCount,
    total_eligible: eligibleMissionaries.length
  });
}
