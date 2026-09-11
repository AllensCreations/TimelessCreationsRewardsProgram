import { handleBotMessage } from '../lib/botHandler.js';
import { runSql } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { clearDebounce, hasUsedDailyCheck, getTodayDateStr } from '../lib/security.js';

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  let bodyData = {};
  if (req.body) {
    bodyData = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }

  const action = req.query?.action || bodyData.action;
  const psid = bodyData.psid || "SIM_PSID_9999";

  try {
    if (action === "reset_session") {
      clearDebounce(psid);
      await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);
      await runSql("DELETE FROM missionaries WHERE psid = ?", [psid]);
      await runSql("DELETE FROM chat_messages WHERE psid = ?", [psid]);
      await runSql("DELETE FROM bot_rate_limits WHERE psid = ?", [psid]);
      await runSql("DELETE FROM bot_daily_user_quotas WHERE psid = ?", [psid]);
      await runSql("DELETE FROM bot_daily_views WHERE sender_id = ?", [psid]);
      await runSql("INSERT INTO system_logs (level, message) VALUES ('TURSO', ?)", [`RESET session for PSID ${psid}`]);
      return res.status(200).json({ ok: true, message: "Session and test user reset successfully." });
    }

    const todayStr = getTodayDateStr();

    if (action === "inspect_session") {
      const session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [psid]))[0] || null;
      const missionary = (await runSql("SELECT * FROM missionaries WHERE psid = ?", [psid]))[0] || null;
      const recentLogs = await runSql("SELECT level, message, created_at FROM system_logs ORDER BY id DESC LIMIT 5");
      const quotaRows = await runSql("SELECT msg_count, warned, otp_resend_count FROM bot_daily_user_quotas WHERE psid = ? AND quota_date = ? LIMIT 1", [psid, todayStr]);
      const quotaRec = quotaRows?.[0] || { msg_count: 0, warned: 0, otp_resend_count: 0 };
      const isVerified = missionary !== null && missionary.email && missionary.name && missionary.name !== 'Missionary';
      const checkUsed = await hasUsedDailyCheck(psid);
      const quota = {
        msg_count: Number(quotaRec.msg_count) || 0,
        limit: isVerified ? 15 : 10,
        otp_resends: Number(quotaRec.otp_resend_count) || 0,
        max_otp_resends: 3
      };
      return res.status(200).json({ ok: true, session, missionary, quota, daily_check_used: checkUsed, recent_logs: recentLogs });
    }

    if (action === "send_message") {
      const text = bodyData.text || "";
      const payload = bodyData.payload || null;

      const lastMsg = (await runSql("SELECT MAX(id) as max_id FROM chat_messages WHERE psid = ?", [psid]))[0];
      const maxId = Number(lastMsg?.max_id) || 0;

      await handleBotMessage(psid, text, payload);

      const session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [psid]))[0] || null;
      const missionary = (await runSql("SELECT * FROM missionaries WHERE psid = ?", [psid]))[0] || null;
      const recentTursoQueries = await runSql("SELECT id, level, message, created_at FROM system_logs ORDER BY id DESC LIMIT 5");
      const botResponses = await runSql("SELECT message, created_at FROM chat_messages WHERE psid = ? AND sender = 'bot' AND id > ? ORDER BY id ASC", [psid, maxId]);
      const quotaRows = await runSql("SELECT msg_count, warned, otp_resend_count FROM bot_daily_user_quotas WHERE psid = ? AND quota_date = ? LIMIT 1", [psid, todayStr]);
      const quotaRec = quotaRows?.[0] || { msg_count: 0, warned: 0, otp_resend_count: 0 };
      const isVerified = missionary !== null && missionary.email && missionary.name && missionary.name !== 'Missionary';
      const quota = {
        msg_count: Number(quotaRec.msg_count) || 0,
        limit: isVerified ? 15 : 10,
        otp_resends: Number(quotaRec.otp_resend_count) || 0,
        max_otp_resends: 3
      };

      const checkUsed = await hasUsedDailyCheck(psid);

      return res.status(200).json({
        ok: true,
        session_state: session?.state || "START",
        session_data: session || null,
        missionary_profile: missionary,
        quota,
        daily_check_used: checkUsed,
        bot_responses: botResponses || [],
        turso_logs: recentTursoQueries || []
      });
    }

    return res.status(400).json({ ok: false, error: "Unknown simulator action" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
