import 'dotenv/config';
import { runSql } from '../lib/db.js';
import { sendDripEmail } from '../lib/mailer.js';

export default async function handler(req, res) {
  // Protect cron endpoint with optional CRON_SECRET authorization header
  const authHeader = req.headers?.authorization || req.query?.key;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}` && authHeader !== process.env.CRON_SECRET) {
    return res.status(401).json({ ok: false, error: "Unauthorized cron execution." });
  }

  try {
    // Check if master power switch is enabled
    const powerSetting = (await runSql("SELECT value FROM system_settings WHERE key = 'power_state'"))[0];
    if (powerSetting && powerSetting.value === "OFFLINE") {
      return res.status(200).json({ ok: true, message: "System is in sleep mode. No drips sent." });
    }

    // Query missionaries due for their next monthly drip
    const dueMissionaries = await runSql(`
      SELECT email, name, cohort, months_sent, max_months 
      FROM missionaries 
      WHERE status = 'active'
        AND months_sent < max_months
        AND (next_send_date <= date('now') OR next_send_date IS NULL OR last_sent_at IS NULL)
      LIMIT 100
    `);

    if (!dueMissionaries || dueMissionaries.length === 0) {
      return res.status(200).json({ ok: true, sentCount: 0, message: "All missionaries are up-to-date." });
    }

    let sentCount = 0;
    const errors = [];

    for (const m of dueMissionaries) {
      const nextMonth = (Number(m.months_sent) || 0) + 1;
      const recipientName = m.name || (m.cohort === 'sister' ? 'Sister' : 'Elder');

      try {
        const delivered = await sendDripEmail(m.email, nextMonth, recipientName);

        if (delivered) {
          await runSql(`
            UPDATE missionaries 
            SET months_sent = months_sent + 1,
                last_sent_at = CURRENT_TIMESTAMP,
                next_send_date = date('now', '+30 days')
            WHERE email = ?
          `, [m.email]);

          await runSql(`
            INSERT INTO system_logs (level, message, created_at)
            VALUES ('INFO', ?, CURRENT_TIMESTAMP)
          `, [`Automated Drip M${nextMonth} dispatched to ${m.name} (${m.email})`]);

          sentCount++;
        } else {
          errors.push(`Brevo rejected email for ${m.email}`);
        }
      } catch (err) {
        errors.push(`Failed for ${m.email}: ${err.message}`);
      }
    }

    return res.status(200).json({
      ok: true,
      sentCount,
      totalDue: dueMissionaries.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error("Cron Error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
