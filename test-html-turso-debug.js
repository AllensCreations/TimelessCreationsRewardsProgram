import 'dotenv/config';
import { runSql } from './lib/db.js';

async function diagnoseConnection() {
  console.log("\n=======================================================");
  console.log("🔍 DETAILED TURSO & HTML ENDPOINT DIAGNOSTIC LOG");
  console.log("=======================================================\n");

  const dbUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  const dbToken = process.env.TURSO_AUTH_TOKEN || process.env.AUTH_TOKEN;

  console.log(`[ENV] Database URL Configured : ${dbUrl ? 'Yes (' + dbUrl.substring(0, 20) + '...)' : 'MISSING ❌'}`);
  console.log(`[ENV] Auth Token Configured   : ${dbToken ? 'Yes (***' + dbToken.slice(-6) + ')' : 'MISSING ❌'}`);

  if (!dbUrl || !dbToken) {
    console.error("\n❌ [CRITICAL] Turso credentials are missing in your environment variables (.env). This is why no database records are loading!");
    return;
  }

  // 1. Test Raw Table Count
  try {
    const countRes = await runSql("SELECT COUNT(*) as total FROM missionaries");
    console.log(`\n✅ [DB CHECK] Connected to Turso successfully!`);
    console.log(`📊 Total missionaries in database: ${countRes?.[0]?.total || 0}`);
  } catch (err) {
    console.error("\n❌ [DB CHECK FAIL] Failed to query missionaries table:", err.message);
  }

  // 2. Test Fetching Sample Rows
  try {
    const rows = await runSql("SELECT email, name, points, status, psid FROM missionaries LIMIT 5");
    console.log("\n📋 Sample Missionaries Records in Turso:");
    console.table(rows);
  } catch (err) {
    console.error("❌ [DB CHECK FAIL] Failed to fetch sample rows:", err.message);
  }

  // 3. Test API Action Response Simulation
  console.log("\n-------------------------------------------------------");
  console.log("🌐 SIMULATING FRONT-END API ENDPOINT (/api/main?action=get_missionaries)");
  try {
    const apiRows = await runSql("SELECT * FROM missionaries ORDER BY email ASC");
    console.log(`✅ API Action 'get_missionaries' returned ${apiRows.length} records.`);
    if (apiRows.length === 0) {
      console.warn("⚠️ WARNING: The table is returning 0 records. If you expected data, your missionaries table in Turso is currently empty or unpopulated!");
    }
  } catch (err) {
    console.error("❌ API Simulation Failed:", err.message);
  }

  console.log("\n=======================================================\n");
}

diagnoseConnection();
