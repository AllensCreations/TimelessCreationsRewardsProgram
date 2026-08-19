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

function getDripHtml(name, monthNumber, points, referralCode) {
  // Check if custom template variable exists
  if (process.env.MONTHLY_DRIP_HTML) {
    return process.env.MONTHLY_DRIP_HTML
      .replace(/{{name}}/g, name)
      .replace(/{{month}}/g, String(monthNumber))
      .replace(/{{points}}/g, String(points))
      .replace(/{{referral_code}}/g, referralCode);
  }

  // Default clean drip template
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #333; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #c9a84c; margin-top: 0;">Timeless Creations — Monthly Missionary Inspiration</h2>
      <p>Dear <strong>${name}</strong>,</p>
      <p>Congratulations on serving faithfully! This is your <strong>Month ${monthNumber}</strong> missionary reminder.</p>
      
      <div style="background: #fdfaf3; border-left: 4px solid #c9a84c; padding: 14px; margin: 18px 0;">
        <p style="margin: 0; font-style: italic; color: #555;">"Trust in the Lord with all thine heart; and lean not unto thine own understanding." — Proverbs 3:5</p>
      </div>

      <div style="background: #f5f5f7; padding: 14px; border-radius: 6px; margin-bottom: 20px;">
        <p style="margin: 0 0 6px 0;">⭐ <strong>Your Rewards Status:</strong></p>
        <p style="margin: 0;">• Current Available Points: <strong>${points} Pts</strong></p>
        <p style="margin: 4px 0 0 0;">• Your Referral Code: <strong>${referralCode}</strong></p>
      </div>

      <p style="font-size: 13px; color: #777;">Share your code with fellow missionaries. When they join and verify, you both receive +1 point to redeem missionary gear!</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;"/>
      <p style="font-size: 11px; color: #999; text-align: center;">Timeless Creations Rewards Program • Exclusively for Missionaries</p>
    </div>
  `;
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

  // Find all active missionaries who haven't exceeded their max_months
  // and whose next_send_date is either NULL or in the past/today
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
    const subject = `Timeless Creations: Month ${currentMonthNum} Missionary Inspiration & Rewards`;
    const htmlContent = getDripHtml(m.name || "Missionary", currentMonthNum, m.points || 0, m.referral_code || "TCRP");

    const isSuccess = await sendBrevoEmail(m.email, m.name || "Missionary", subject, htmlContent);

    if (isSuccess) {
      // Calculate next send date: +30 days from now
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 30);
      const nextDateIso = nextDate.toISOString();

      // Update missionary: increment months_sent, set last_sent_at and next_send_date (NO POINT INFLATION)
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

  await logSystemEvent('INFO', `Monthly Drip Executed: ${sentCount} sent, ${failedCount} failed, ${eligibleMissionaries.length} eligible.`);

  return res.status(200).json({
    ok: true,
    sent: sentCount,
    failed: failedCount,
    total_eligible: eligibleMissionaries.length
  });
}
