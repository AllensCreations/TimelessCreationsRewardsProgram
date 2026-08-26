import { runSql } from './db.js';

export async function logSystemEvent(level, message) {
  try {
    const cleanMessage = String(message || '').substring(0, 1000);
    await runSql(
      "INSERT INTO system_logs (level, message, created_at) VALUES (?, ?, datetime('now'));",
      [level.toUpperCase(), cleanMessage]
    );
  } catch (err) {
    console.error("Failed to write to persistent log DB:", err.message);
  }
}
