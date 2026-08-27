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

export async function isRateLimited(psid, limit = 5, windowSeconds = 60) {
  const now = Math.floor(Date.now() / 1000);
  const row = (await runSql("SELECT msg_count, window_start FROM bot_rate_limits WHERE psid = ?", [psid]))[0];

  if (!row) {
    await runSql("INSERT INTO bot_rate_limits (psid, msg_count, window_start) VALUES (?, 1, ?)", [psid, now]);
    return false;
  }

  if (now - row.window_start > windowSeconds) {
    await runSql("UPDATE bot_rate_limits SET msg_count = 1, window_start = ? WHERE psid = ?", [now, psid]);
    return false;
  }

  if (row.msg_count >= limit) {
    return true;
  }

  await runSql("UPDATE bot_rate_limits SET msg_count = msg_count + 1 WHERE psid = ?", [psid]);
  return false;
}
