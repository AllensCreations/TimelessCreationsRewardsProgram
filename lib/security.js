import crypto from 'crypto';
import { runSql } from './db.js';

export function verifyFbSignature(req, rawBody) {
  const secret = (process.env.FB_APP_SECRET || '').trim().replace(/^["']|["']$/g, '');
  if (!secret) {
    if (process.env.NODE_ENV === 'production') return false;
    return true; 
  }

  const signature = (req.headers?.['x-hub-signature-256'] || req.headers?.['X-Hub-Signature-256'] || '').trim();
  if (!signature) return false;

  const bodyToVerify = (rawBody !== undefined && rawBody !== null) ? rawBody : (req.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})));
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(bodyToVerify).digest('hex');
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
 * Returns today's date in UTC+8 (Asia/Manila time zone)
 * Format: YYYY-MM-DD
 */
export function getTodayDateStr() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().split('T')[0];
}

/**
 * Returns the daily view limit tracking date, resetting every morning at 8:00 AM PHT (00:00 UTC).
 * Format: YYYY-MM-DD
 */
export function getDailyViewDateStr() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Helper to fetch integer setting from system_settings with safe fallback
 */
export async function getSystemSettingInt(key, defaultVal) {
  try {
    const rows = await runSql("SELECT value FROM system_settings WHERE key = ?", [key]);
    if (rows && rows.length > 0 && rows[0].value !== undefined && rows[0].value !== null) {
      const num = parseInt(rows[0].value, 10);
      if (!isNaN(num)) return num;
    }
  } catch (_) {}
  return defaultVal;
}

// ----------------------------------------------------
// 1. Double-Tap Debounce (3-Second Quota-Safe Deduping)
// ----------------------------------------------------
const recentDebounceMap = new Map();

/**
 * Clears the debounce map for a specific PSID (or all if omitted)
 */
export function clearDebounce(psid = null, clearViews = true) {
  if (!psid) {
    recentDebounceMap.clear();
    if (clearViews) runSql("DELETE FROM bot_daily_views").catch(() => {});
    return;
  }
  for (const [k] of recentDebounceMap.entries()) {
    if (k.startsWith(`${psid}:`)) recentDebounceMap.delete(k);
  }
  if (clearViews) runSql("DELETE FROM bot_daily_views WHERE sender_id = ?", [psid]).catch(() => {});
}

export function clearRapidDebounce(psid = null) {
  clearDebounce(psid, false);
}

/**
 * Prevents accidental double-taps/button-mashing on mobile Messenger from wasting daily quota.
 * Returns true if an identical message was received within 3000ms from the same PSID.
 * Drops the single immediate double tap while allowing burst flooding to reach the rate limiter.
 */
export function isDoubleTapDuplicate(psid, messageIdentifier) {
  if (!psid || !messageIdentifier) return false;
  const now = Date.now();
  const key = `${psid}:${messageIdentifier}`;
  const record = recentDebounceMap.get(key);

  // Prune map if it grows large
  if (recentDebounceMap.size > 1000) {
    for (const [k, v] of recentDebounceMap.entries()) {
      if (now - v.time > 10000) recentDebounceMap.delete(k);
    }
  }

  if (record && (now - record.time < 3000)) {
    if (!record.dropped) {
      record.dropped = true;
      record.time = now;
      recentDebounceMap.set(key, record);
      return true;
    }
    record.time = now;
    recentDebounceMap.set(key, record);
    return false;
  }

  recentDebounceMap.set(key, { time: now, dropped: false });
  return false;
}

// ----------------------------------------------------
// 2. Anti-Flooding Rapid Burst Rate Limiter
// Max 12 messages per 60 seconds (Warn Once + Polite Drop)
// ----------------------------------------------------
export async function checkBurstRateLimit(psid, limit = 12, windowSeconds = 60) {
  const now = Math.floor(Date.now() / 1000);
  const rows = await runSql("SELECT msg_count, window_start, warned FROM bot_rate_limits WHERE psid = ?", [psid]);
  const record = rows?.[0];

  if (!record) {
    await runSql("INSERT INTO bot_rate_limits (psid, msg_count, window_start, warned) VALUES (?, 1, ?, 0)", [psid, now]);
    return { limited: false, silentDrop: false };
  }

  if (now - Number(record.window_start) > windowSeconds) {
    await runSql("UPDATE bot_rate_limits SET msg_count = 1, window_start = ?, warned = 0 WHERE psid = ?", [now, psid]);
    return { limited: false, silentDrop: false };
  }

  if (Number(record.msg_count) >= limit) {
    const alreadyWarned = Number(record.warned) === 1;
    if (!alreadyWarned) {
      await runSql("UPDATE bot_rate_limits SET warned = 1 WHERE psid = ?", [psid]);
      return { limited: true, silentDrop: false };
    }
    return { limited: true, silentDrop: true };
  }

  await runSql("UPDATE bot_rate_limits SET msg_count = msg_count + 1 WHERE psid = ?", [psid]);
  return { limited: false, silentDrop: false };
}

/**
 * Backward-compatible boolean wrapper for tests and external callers
 */
export async function isRateLimited(psid, limit = 12, windowSeconds = 60) {
  const res = await checkBurstRateLimit(psid, limit, windowSeconds);
  return res.limited;
}

// ----------------------------------------------------
// 3. Daily Message Quota (10 Unverified / 15 Verified)
// Resets Midnight UTC+8 with Warn-Once + Silent Drop
// ----------------------------------------------------
export async function checkDailyMessageQuota(psid, isVerified = false) {
  const todayStr = getTodayDateStr();
  const unverifiedCap = await getSystemSettingInt('bot_quota_unverified', 10);
  const verifiedCap = await getSystemSettingInt('bot_quota_verified', 15);
  const limit = isVerified ? verifiedCap : unverifiedCap;

  try {
    const rows = await runSql(
      "SELECT msg_count, warned, otp_resend_count FROM bot_daily_user_quotas WHERE psid = ? AND quota_date = ? LIMIT 1",
      [psid, todayStr]
    );
    const record = rows?.[0];

    if (!record) {
      await runSql(
        "INSERT INTO bot_daily_user_quotas (psid, quota_date, msg_count, warned, otp_resend_count) VALUES (?, ?, 1, 0, 0)",
        [psid, todayStr]
      );
      return { allowed: true, current: 1, limit, remaining: Math.max(0, limit - 1) };
    }

    const currentCount = Number(record.msg_count) || 0;
    if (currentCount >= limit) {
      const alreadyWarned = Number(record.warned) === 1;
      if (!alreadyWarned) {
        await runSql("UPDATE bot_daily_user_quotas SET warned = 1 WHERE psid = ? AND quota_date = ?", [psid, todayStr]);
        return { allowed: false, silentDrop: false, current: currentCount, limit };
      }
      return { allowed: false, silentDrop: true, current: currentCount, limit };
    }

    const newCount = currentCount + 1;
    await runSql("UPDATE bot_daily_user_quotas SET msg_count = ? WHERE psid = ? AND quota_date = ?", [newCount, psid, todayStr]);
    return { allowed: true, current: newCount, limit, remaining: Math.max(0, limit - newCount) };
  } catch (err) {
    // If DB fails, fail open safely
    return { allowed: true, current: 1, limit, remaining: limit - 1 };
  }
}

// ----------------------------------------------------
// 4. OTP Verification & Resend Anti-Abuse
// Cooldown (60s) + Max Daily Resends (3)
// ----------------------------------------------------
export async function checkOtpResendEligibility(psid, session) {
  const cooldownSec = await getSystemSettingInt('bot_otp_cooldown', 60);
  const maxResends = await getSystemSettingInt('bot_otp_max_resends', 3);
  const now = Math.floor(Date.now() / 1000);
  const lastOtpAt = Number(session?.last_otp_at) || 0;
  const elapsed = now - lastOtpAt;

  // 1. Check Cooldown
  if (lastOtpAt > 0 && elapsed < cooldownSec) {
    const remainingSeconds = cooldownSec - elapsed;
    return { allowed: false, reason: 'COOLDOWN', remainingSeconds, cooldownSec };
  }

  // 2. Check Daily Resend Count
  const todayStr = getTodayDateStr();
  try {
    const rows = await runSql(
      "SELECT otp_resend_count FROM bot_daily_user_quotas WHERE psid = ? AND quota_date = ? LIMIT 1",
      [psid, todayStr]
    );
    const usedCount = Number(rows?.[0]?.otp_resend_count) || 0;
    if (usedCount >= maxResends) {
      return { allowed: false, reason: 'MAX_RESENDS_REACHED', usedCount, maxResends };
    }
    return { allowed: true, usedCount, maxResends, cooldownSec };
  } catch (_) {
    return { allowed: true, usedCount: 0, maxResends, cooldownSec };
  }
}

export async function recordOtpResend(psid) {
  const todayStr = getTodayDateStr();
  try {
    const rows = await runSql(
      "SELECT otp_resend_count FROM bot_daily_user_quotas WHERE psid = ? AND quota_date = ? LIMIT 1",
      [psid, todayStr]
    );
    if (!rows || rows.length === 0) {
      await runSql(
        "INSERT INTO bot_daily_user_quotas (psid, quota_date, msg_count, warned, otp_resend_count) VALUES (?, ?, 0, 0, 1)",
        [psid, todayStr]
      );
      return 1;
    }
    const nextCount = (Number(rows[0].otp_resend_count) || 0) + 1;
    await runSql(
      "UPDATE bot_daily_user_quotas SET otp_resend_count = ? WHERE psid = ? AND quota_date = ?",
      [nextCount, psid, todayStr]
    );
    return nextCount;
  } catch (_) {
    return 1;
  }
}

// ----------------------------------------------------
// 5. Heavy Resource / Daily View Rate Limiter
// Max 1 check / rewards dashboard view per day per PSID
// ----------------------------------------------------
export async function checkDailyViewLimit(senderId, dailyMax = 1) {
  const sid = String(senderId);
  const todayStr = getDailyViewDateStr();

  try {
    const rows = await runSql(
      "SELECT view_count FROM bot_daily_views WHERE sender_id = ? AND view_date = ? LIMIT 1",
      [sid, todayStr]
    );

    const currentCount = Number(rows?.[0]?.view_count || 0);
    if (currentCount >= dailyMax) {
      return { allowed: false, remaining: 0, current: currentCount, dailyMax };
    }

    const newCount = currentCount + 1;
    await runSql(`
      INSERT INTO bot_daily_views (sender_id, view_date, view_count, warned) 
      VALUES (?, ?, ?, 0) 
      ON CONFLICT(sender_id, view_date) DO UPDATE SET view_count = ?
    `, [sid, todayStr, newCount, newCount]);

    return { allowed: true, remaining: dailyMax - newCount, current: newCount, dailyMax };
  } catch (err) {
    return { allowed: true, remaining: 1, current: 1, dailyMax };
  }
}

export const checkDashboardRateLimit = checkDailyViewLimit;

