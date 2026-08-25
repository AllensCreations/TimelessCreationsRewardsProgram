#!/bin/bash
echo "🔍 Running TCRP Diagnostic Tester..."
node -e '
import("./lib/db.js").then(async db => {
  try {
    console.log("1. Testing system_config table write...");
    await db.queryTurso([{ type: "execute", stmt: { sql: "INSERT OR REPLACE INTO system_config (key, value) VALUES (\x27master_power\x27, \x27online\x27)", args: [] } }]);
    console.log("   ✅ Turso system_config write successful!");

    const rows = await db.runSql("SELECT value FROM system_config WHERE key = \x27master_power\x27");
    console.log("   ✅ Turso system_config read successful! Current power state:", rows[0]?.value);
  } catch (err) {
    console.error("   ❌ Turso Diagnostic Error:", err.message);
  }
});
'
