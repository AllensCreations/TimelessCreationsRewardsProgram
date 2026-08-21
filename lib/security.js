import crypto from 'crypto';
import { runSql } from './db.js';

// Verify Facebook Webhook HMAC SHA256 signature
export function verifyFbSignature(req, rawBody) {
  const secret = process.env.FB_APP_SECRET;
  if (!secret) return true; // Skip if no secret configured in testing

  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;

  const expectedSignature = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

// Rate Limiter: Max 5 messages / requests per minute per PSID
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
    return true; // Limit exceeded
  }

  await runSql("UPDATE bot_rate_limits SET msg_count = msg_count + 1 WHERE psid = ?", [psid]);
  return false;
}
