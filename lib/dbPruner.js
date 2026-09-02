import { runSql } from './db.js';

export async function runDatabaseMaintenance() {
  try {
    await runSql("DELETE FROM system_logs WHERE created_at < datetime('now', '-30 days')");
    await runSql("DELETE FROM bot_rate_limits WHERE window_start < strftime('%s','now','-24 hours')");
    await runSql("DROP TABLE IF EXISTS hashed_audit_identities;").catch(() => {});
    await runSql("DROP TABLE IF EXISTS bot_hourly_views;").catch(() => {});
    await runSql("PRAGMA optimize;");
    
    try {
      await runSql("VACUUM;");
    } catch (vacuumErr) {
      console.log("Notice: VACUUM handled by Turso backend or restricted:", vacuumErr.message);
    }

    await runSql("INSERT INTO system_logs (level, message, created_at) VALUES ('INFO', 'Executed periodic database vacuum, pragma optimization, table pruning, and log cleanup', CURRENT_TIMESTAMP)");

    return { ok: true, message: "Database maintenance and optimization completed successfully." };
  } catch (err) {
    console.error("Database maintenance error:", err.message);
    return { ok: false, error: err.message };
  }
}
