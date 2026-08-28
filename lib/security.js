import crypto from 'crypto';
import { runSql } from './db.js';

export function verifyFbSignature(req, rawBody) {
  const secret = process.env.FB_APP_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') return false;
    return true; 
  }

  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;

  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

/**
 * A. Rapid-Fire / Anti-Flooding Rate Limiter (Short Window)
 * Max 5 messages per 60 seconds per PSID
 */
export async function isRateLimited(psid, limit = 5, windowSeconds = 60) {
  const now = Math.floor(Date.now() / 1000);
  const rows = await runSql("SELECT msg_count, window_start FROM bot_rate_limits WHERE psid = ?", [psid]);
  const record = rows?.[0];

  if (!record) {
    await runSql("INSERT INTO bot_rate_limits (psid, msg_count, window_start) VALUES (?, 1, ?)", [psid, now]);
    return false;
  }

  if (now - record.window_start > windowSeconds) {
    await runSql("UPDATE bot_rate_limits SET msg_count = 1, window_start = ? WHERE psid = ?", [now, psid]);
    return false;
  }

  if (Number(record.msg_count) >= limit) {
    return true;
  }

  await runSql("UPDATE bot_rate_limits SET msg_count = msg_count + 1 WHERE psid = ?", [psid]);
  return false;
}

/**
 * B. Heavy Resource / Daily View Rate Limiter (Long Window)
 * Max 3 rich catalog/carousel views per day per PSID
 */
export async function checkDailyViewLimit(senderId, dailyMax = 3) {
  const sid = String(senderId);
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    const rows = await runSql(
      "SELECT view_count FROM bot_daily_views WHERE sender_id = ? AND view_date = ? LIMIT 1",
      [sid, todayStr]
    );

    const currentCount = Number(rows?.[0]?.view_count || 0);
    if (currentCount >= dailyMax) {
      return { allowed: false, remaining: 0 };
    }

    const newCount = currentCount + 1;
    await runSql(`
      INSERT INTO bot_daily_views (sender_id, view_date, view_count, warned) 
      VALUES (?, ?, ?, 0) 
      ON CONFLICT(sender_id, view_date) DO UPDATE SET view_count = ?
    `, [sid, todayStr, newCount, newCount]);

    return { allowed: true, remaining: dailyMax - newCount };
  } catch (err) {
    return { allowed: true, remaining: 1 };
  }
}
