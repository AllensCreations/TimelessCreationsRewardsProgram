echo "🧪 Testing Turso System Power State..."
node -e '
import("./lib/db.js").then(async db => {
  try {
    console.log("Checking current power state in Turso...");
    const rows = await db.runSql("SELECT value FROM system_settings WHERE key = 'power_state'");
    console.log("Current state:", rows[0]?.value || "ONLINE (default)");
  } catch (err) {
    console.error("Error reading power state:", err.message);
  }
});
'
