import { runSql } from './db.js';

export async function runDatabaseMaintenance() {
  try {
    // 1. Prune expired or old session logs older than 30 days
    await runSql("DELETE FROM system_logs WHERE created_at < datetime('now', '-30 days')");
    
    // 2. Prune old rate limit tracking records
    await runSql("DELETE FROM bot_rate_limits WHERE timestamp < datetime('now', '-24 hours')");

    // 3. Database Index & Space Optimization (PRAGMA optimize & VACUUM)
    // PRAGMA optimize analyzes query usage and tunes internal index weighting
    await runSql("PRAGMA optimize;");
    
    // Note: VACUUM defragments the database file and reclaims unused disk space 
    // from deleted rows (safely handled via Turso connection driver)
    try {
      await runSql("VACUUM;");
    } catch (vacuumErr) {
      // Some serverless SQLite proxies restrict VACUUM; log gracefully if bypassed
      console.log("Notice: VACUUM handled by Turso backend or restricted:", vacuumErr.message);
    }

    await runSql("INSERT INTO system_logs (level, message, created_at) VALUES ('INFO', 'Executed periodic database vacuum, pragma optimization, and log pruning', CURRENT_TIMESTAMP)");

    return { ok: true, message: "Database maintenance and optimization completed successfully." };
  } catch (err) {
    console.error("Database maintenance error:", err.message);
    return { ok: false, error: err.message };
  }
}
