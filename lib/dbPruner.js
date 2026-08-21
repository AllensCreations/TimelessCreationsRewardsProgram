import { runSql } from './db.js';

export async function runDatabaseMaintenance() {
  try {
    // Prune expired OTP sessions older than 24 hours
    await runSql("DELETE FROM sessions WHERE last_otp_at < (strftime('%s', 'now') - 86400)");

    // Keep only the latest 2,000 system logs to prevent database bloat
    await runSql(`
      DELETE FROM system_logs 
      WHERE id NOT IN (SELECT id FROM system_logs ORDER BY id DESC LIMIT 2000)
    `);

    // Reset bot rate limit windows older than 1 hour
    await runSql("DELETE FROM bot_rate_limits WHERE window_start < (strftime('%s', 'now') - 3600)");

    // Run SQLite optimizer
    await runSql("PRAGMA optimize");

    return { ok: true, message: "Database maintenance completed successfully." };
  } catch (err) {
    console.error("DB Maintenance Error:", err.message);
    return { ok: false, error: err.message };
  }
}
