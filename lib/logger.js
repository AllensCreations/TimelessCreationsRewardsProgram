import { queryTurso } from './db.js';

export async function logSystemEvent(level, message) {
  try {
    const cleanMessage = String(message || '').substring(0, 1000);
    await queryTurso([
      { type: "execute", stmt: { sql: "CREATE TABLE IF NOT EXISTS system_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, level TEXT DEFAULT 'INFO', message TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);" } },
      {
        type: "execute",
        stmt: {
          sql: "INSERT INTO system_logs (level, message, created_at) VALUES (?, ?, datetime('now'));",
          args: [
            { type: "text", value: level.toUpperCase() },
            { type: "text", value: cleanMessage }
          ]
        }
      }
    ]);
  } catch (err) {
    console.error("Failed to write to persistent log DB:", err.message);
  }
}
