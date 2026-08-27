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
      await runSql("INSERT INTO system_logs (level, message) VALUES ('TURSO', ?)", [`RESET session for PSID ${psid}`]);
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

      await handleBotMessage(psid, text, payload);

      const session = (await runSql("SELECT * FROM sessions WHERE psid = ?", [psid]))[0] || null;
      const missionary = (await runSql("SELECT * FROM missionaries WHERE psid = ?", [psid]))[0] || null;
      const recentTursoQueries = await runSql("SELECT id, level, message, created_at FROM system_logs ORDER BY id DESC LIMIT 5");

      return res.status(200).json({
        ok: true,
        session_state: session?.state || "START",
        session_data: session || null,
        missionary_profile: missionary,
        turso_logs: recentTursoQueries || []
      });
    }

    return res.status(400).json({ ok: false, error: "Unknown simulator action" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
