import 'dotenv/config';
import { runSql } from './lib/db.js';

async function fullReset() {
  console.log("🧹 Wiping all session states and unlinking test PSIDs from Turso...");
  await runSql("DELETE FROM sessions");
  await runSql("UPDATE missionaries SET psid = NULL");
  await runSql("INSERT INTO system_logs (level, message) VALUES ('INFO', 'Performed manual full-system reset via reset-db.js')");
  console.log("✅ Database successfully reset! All users will now be forced to experience the fresh Get Started onboarding flow.");
}

fullReset();
