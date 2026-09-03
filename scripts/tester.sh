#!/bin/bash
echo "🔍 Running TCRP Diagnostic Tester..."
node -e '
import("./lib/db.js").then(async db => {
  try {
    console.log("1. Testing system_settings table write...");
    await db.queryTurso([{ type: "execute", stmt: { sql: "INSERT OR REPLACE INTO system_settings (key, value) VALUES (\x27power_state\x27, \x27ONLINE\x27)", args: [] } }]);
    console.log("   ✅ Turso system_settings write successful!");

    const rows = await db.runSql("SELECT value FROM system_settings WHERE key = \x27power_state\x27");
    console.log("   ✅ Turso system_settings read successful! Current power state:", rows[0]?.value);
  } catch (err) {
    console.error("   ❌ Turso Diagnostic Error:", err.message);
  }
});
'
