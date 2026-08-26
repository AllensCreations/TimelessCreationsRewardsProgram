import 'dotenv/config';
import { runSql } from './lib/db.js';

async function reset() {
  console.log('🧹 Clearing sessions and unlinking test PSIDs in Turso...');
  await runSql('DELETE FROM sessions');
  await runSql('UPDATE missionaries SET psid = NULL');
  await runSql("INSERT INTO system_logs (level, message) VALUES ('INFO', 'Database reset: All PSIDs unlinked for clean onboarding testing')");
  console.log('✅ Done! All unverified users will now strictly see Get Started.');
}
reset();
