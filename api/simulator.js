import { handleBotMessage } from '../lib/botHandler.js';
import { runSql } from '../lib/db.js';

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
      await runSql("DELETE FROM sessions WHERE psid = ?", [psid]);
      await runSql("DELETE FROM missionaries WHERE psid = ?", [psid]);
      return res.status(200).json({ ok: true, message: "Session and test user reset successfully." });
    }

    if (action === "inspect_session") {
      const session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [psid]))[0] || null;
      const missionary = (await runSql("SELECT * FROM missionaries WHERE psid = ?", [psid]))[0] || null;
      const recentLogs = await runSql("SELECT level, message, created_at FROM system_logs ORDER BY id DESC LIMIT 5");
      return res.status(200).json({ ok: true, session, missionary, recent_logs: recentLogs });
    }

    if (action === "send_message") {
      const text = bodyData.text || "";
      const payload = bodyData.payload || null;

      // Capture bot replies dispatched via callSendAPI by overriding fetch or logging table
      await handleBotMessage(psid, text, payload);

      // Fetch the last logged bot messages from chat_messages or system_logs
      const botMessages = await runSql("SELECT message, created_at FROM chat_messages WHERE psid = ? ORDER BY id DESC LIMIT 5", [psid]);
      const session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [psid]))[0] || null;
      const missionary = (await runSql("SELECT * FROM missionaries WHERE psid = ?", [psid]))[0] || null;

      return res.status(200).json({
        ok: true,
        bot_responses: botMessages || [],
        session_state: session?.state || "START",
        missionary_profile: missionary
      });
    }

    return res.status(400).json({ ok: false, error: "Unknown simulator action" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
