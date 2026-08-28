import 'dotenv/config';
import { runSql } from '../lib/db.js';
import { sendDripEmail } from '../lib/mailer.js';

export default async function handler(req, res) {
  const authHeader = req.headers?.authorization || req.query?.key;
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return res.status(500).json({ ok: false, error: "CRON_SECRET not configured — refusing to run." });
  }
  if (authHeader !== `Bearer ${secret}` && authHeader !== secret) {
    return res.status(401).json({ ok: false, error: "Unauthorized cron execution." });
  }

  try {
    const powerSetting = (await runSql("SELECT value FROM system_settings WHERE key = 'power_state'"))[0];
    const isOffline = (powerSetting?.value || 'ONLINE').toUpperCase() === 'OFFLINE';

    if (isOffline) {
      await runSql("INSERT INTO system_logs (level, message, created_at) VALUES ('INFO', 'Cron triggered but aborted: System power state is OFFLINE', CURRENT_TIMESTAMP)");
      return res.status(200).json({ ok: true, sentCount: 0, message: "System is OFFLINE. Dispatches paused." });
    }

    const dueElders = await runSql(`
      SELECT email, name, cohort, months_sent, max_months, last_sent_at, next_send_date
      FROM missionaries 
      WHERE status = 'active'
        AND LOWER(cohort) = 'elder'
        AND months_sent < max_months
        AND (next_send_date <= date('now') OR next_send_date IS NULL OR last_sent_at IS NULL)
      ORDER BY 
        CASE WHEN last_sent_at IS NULL THEN 0 ELSE 1 END ASC,
        last_sent_at ASC,
        ROWID ASC
      LIMIT 28
    `);

    const dueSisters = await runSql(`
      SELECT email, name, cohort, months_sent, max_months, last_sent_at, next_send_date
      FROM missionaries 
      WHERE status = 'active'
        AND LOWER(cohort) = 'sister'
        AND months_sent < max_months
        AND (next_send_date <= date('now') OR next_send_date IS NULL OR last_sent_at IS NULL)
      ORDER BY 
        CASE WHEN last_sent_at IS NULL THEN 0 ELSE 1 END ASC,
        last_sent_at ASC,
        ROWID ASC
      LIMIT 28
    `);

    const dueMissionaries = [...(dueElders || []), ...(dueSisters || [])];

    if (!dueMissionaries || dueMissionaries.length === 0) {
      return res.status(200).json({ ok: true, sentCount: 0, message: "All missionaries are up-to-date." });
    }

    let sentCount = 0;
    const errors = [];

    for (const m of dueMissionaries) {
      const nextMonth = (Number(m.months_sent) || 0) + 1;
      const isSister = (m.cohort || '').toLowerCase().includes('sister');
      const recipientName = m.name || (isSister ? 'Sister' : 'Elder');

      try {
        const result = await sendDripEmail(m.email, nextMonth, recipientName);

        if (result?.ok) {
          await runSql(`
            UPDATE missionaries 
            SET months_sent = months_sent + 1,
                last_sent_at = CURRENT_TIMESTAMP,
                next_send_date = date('now', '+1 month')
            WHERE LOWER(email) = LOWER(?)
          `, [m.email]);

          await runSql(`
            INSERT INTO system_logs (level, message, created_at)
            VALUES ('DISPATCH', ?, CURRENT_TIMESTAMP)
          `, [`[EMAIL_DISPATCH] M${nextMonth} sent to ${m.name} (${m.email})`]);

          sentCount++;
        } else {
          errors.push(`Brevo rejected email for ${m.email}: ${result?.error || 'Unknown error'}`);
        }
      } catch (err) {
        errors.push(`Failed for ${m.email}: ${err.message}`);
      }
    }

    return res.status(200).json({
      ok: true,
      sentCount,
      eldersProcessed: dueElders?.length || 0,
      sistersProcessed: dueSisters?.length || 0,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error("Cron Error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
