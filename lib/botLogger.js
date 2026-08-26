import { runSql } from './db.js';

export async function logBotEvent(level, message, psid = 'SYSTEM') {
  const cleanMsg = `[BOT:${psid}] ${message}`.substring(0, 1000);
  console.log(`[${level.toUpperCase()}] ${cleanMsg}`);
  try {
    await runSql(
      "INSERT INTO system_logs (level, message, created_at) VALUES (?, ?, datetime('now'));",
      [level.toUpperCase(), cleanMsg]
    );
  } catch (err) {
    console.error("Failed to write to system_logs:", err.message);
  }
}
