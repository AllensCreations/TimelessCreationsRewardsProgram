echo "🧪 Testing Turso System Power State..."
node -e '
import("./lib/db.js").then(async db => {
  try {
    console.log("Checking current power state in Turso...");
    const rows = await db.runSql("SELECT value FROM system_config WHERE key = \x27master_power\x27");
    console.log("Current state:", rows[0]?.value || "online (default)");
  } catch (err) {
    console.error("Error reading power state:", err.message);
  }
});
'
