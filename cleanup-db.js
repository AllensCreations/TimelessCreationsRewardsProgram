import 'dotenv/config';
import { runSql } from './lib/db.js';

async function cleanupTables() {
  console.log("🧹 Cleaning up unnecessary / obsolete Turso database tables...");
  try {
    await runSql("DROP TABLE IF EXISTS bot_daily_views;");
    console.log("✅ Dropped obsolete table 'bot_daily_views'.");
  } catch (err) {
    console.log("Notice on drop:", err.message);
  }
}

cleanupTables();
