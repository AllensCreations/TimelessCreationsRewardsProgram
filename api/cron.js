import 'dotenv/config';
import { runSql } from '../lib/db.js';
import { sendDripEmail, getCalendarMonthLabel } from '../lib/mailer.js';
import { cache } from '../lib/cache.js';
import { getFirstMonthInfo, calculateMissionMonth, isMissionaryEligibleForDispatch, getMissionMonthInfo, getUpcomingDripInfo } from '../lib/utils/batchCalculator.js';

const inFlightCronDispatches = new Set();

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
    const rowSettings = await runSql("SELECT value FROM system_settings WHERE key = 'power_state'").catch(() => []);
    const powerVal = rowSettings?.[0]?.value;
    const isOffline = powerVal && String(powerVal).toUpperCase() === 'OFFLINE';

    if (isOffline) {
      await runSql("INSERT INTO system_logs (level, message, created_at) VALUES ('INFO', 'Cron triggered but aborted: System power state is OFFLINE', CURRENT_TIMESTAMP)");
      return res.status(200).json({ ok: true, sentCount: 0, message: "System is OFFLINE. Dispatches paused." });
    }

    const phtNow = new Date(Date.now() + 8 * 3600 * 1000);
    const todayPhtIso = phtNow.toISOString().slice(0, 10);

    // Query active candidates who have not finished tenure
    const [rawElders, rawSisters] = await Promise.all([
      runSql(`
        SELECT email, name, cohort, batch_month, months_sent, max_months, last_sent_at, next_send_date
        FROM missionaries 
        WHERE status = 'active'
          AND LOWER(cohort) = 'elder'
          AND months_sent < max_months
          AND (next_send_date <= date('now', '+8 hours') OR next_send_date IS NULL OR last_sent_at IS NULL)
        ORDER BY 
          CASE WHEN last_sent_at IS NULL THEN 0 ELSE 1 END ASC,
          last_sent_at ASC,
          ROWID ASC
        LIMIT 45
      `),
      runSql(`
        SELECT email, name, cohort, batch_month, months_sent, max_months, last_sent_at, next_send_date
        FROM missionaries 
        WHERE status = 'active'
          AND LOWER(cohort) = 'sister'
          AND months_sent < max_months
          AND (next_send_date <= date('now', '+8 hours') OR next_send_date IS NULL OR last_sent_at IS NULL)
        ORDER BY 
          CASE WHEN last_sent_at IS NULL THEN 0 ELSE 1 END ASC,
          last_sent_at ASC,
          ROWID ASC
        LIMIT 45
      `)
    ]);

    // Filter strictly by cohort schedule eligibility (Month 0 is NOT due; only Month >= 1)
    const dueElders = (rawElders || []).filter(m => isMissionaryEligibleForDispatch(m, phtNow, todayPhtIso)).slice(0, 23);
    const dueSisters = (rawSisters || []).filter(m => isMissionaryEligibleForDispatch(m, phtNow, todayPhtIso)).slice(0, 22);
    const dueMissionaries = [...dueElders, ...dueSisters].slice(0, 45);

    if (!dueMissionaries || dueMissionaries.length === 0) {
      return res.status(200).json({ ok: true, sentCount: 0, message: "All missionaries are up-to-date." });
    }

    let sentCount = 0;
    const errors = [];
    const CONCURRENCY_CHUNK_SIZE = 5; // Dispatches 5 in parallel to complete 45 emails in ~2.5s (safely within Vercel 10s timeout)

    for (let i = 0; i < dueMissionaries.length; i += CONCURRENCY_CHUNK_SIZE) {
      const chunk = dueMissionaries.slice(i, i + CONCURRENCY_CHUNK_SIZE);
      await Promise.all(chunk.map(async (m) => {
        const emailKey = (m.email || '').toLowerCase().trim();
        if (!emailKey || inFlightCronDispatches.has(emailKey)) return;
        inFlightCronDispatches.add(emailKey);

        try {
          // Idempotency: verify this missionary was not already dispatched today
          const recentSent = await runSql(`
            SELECT email FROM missionaries 
            WHERE LOWER(email) = ? 
              AND last_sent_at IS NOT NULL 
              AND substr(last_sent_at, 1, 10) = ?
          `, [emailKey, todayPhtIso]).catch(() => []);

          if (recentSent && recentSent.length > 0) {
            return; // Already dispatched today, idempotent skip
          }

          const isSister = (m.cohort || '').toLowerCase().includes('sister');
          const maxMonths = Number(m.max_months) || (isSister ? 18 : 24);
          const recipientName = m.name || (isSister ? 'Sister' : 'Elder');
          const upcoming = getUpcomingDripInfo(m.batch_month || 'August 2026', m.months_sent, maxMonths, phtNow);
          const targetCalMonth = upcoming ? upcoming.monthNum : (phtNow.getMonth() + 1);
          const tenureMonth = upcoming ? upcoming.tenureMonth : ((Number(m.months_sent) || 0) + 1);

          const result = await sendDripEmail(m.email, targetCalMonth, recipientName);
          if (result?.ok) {
            const newMonthsSent = Math.max((Number(m.months_sent) || 0) + 1, tenureMonth);
            await runSql(`
              UPDATE missionaries 
              SET months_sent = ?,
                  last_sent_at = CURRENT_TIMESTAMP,
                  next_send_date = date('now', '+1 month')
              WHERE LOWER(email) = LOWER(?)
            `, [newMonthsSent, m.email]);

            const calLabel = getCalendarMonthLabel(targetCalMonth);
            await runSql(`
              INSERT INTO system_logs (level, message, created_at)
              VALUES ('DISPATCH', ?, CURRENT_TIMESTAMP)
            `, [`[EMAIL_DISPATCH] ${calLabel} (M${tenureMonth}) sent to ${m.name} (${m.email})`]);

            sentCount++;
          } else {
            errors.push(`Brevo rejected ${m.email}: ${result?.error || 'Unknown error'}`);
          }
        } catch (err) {
          errors.push(`Failed for ${m.email}: ${err.message}`);
        } finally {
          inFlightCronDispatches.delete(emailKey);
        }
      }));
    }

    cache.invalidateTag("missionaries");

    return res.status(200).json({
      ok: true,
      sentCount,
      cappedLimit: 45,
      eldersProcessed: dueElders?.length || 0,
      sistersProcessed: dueSisters?.length || 0,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error("Cron Error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
