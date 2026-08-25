import 'dotenv/config';
import { executeBotAction } from './api/bot.js';

console.log("\n🧪 TESTING LIVE WEBHOOK EVENT DISPATCHER...\n");

async function testDispatch() {
  const token = process.env.PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN;
  console.log("Token configured:", token ? `YES (Length: ${token.length})` : "NO ❌");

  if (!token) {
    console.error("❌ Add PAGE_ACCESS_TOKEN to .env first.");
    process.exit(1);
  }

  const mockSenderId = "1265075106685927"; // Self page ping or test recipient
  console.log("Simulating 'ACTION_DASHBOARD' postback...");
  await executeBotAction(mockSenderId, "", "ACTION_DASHBOARD", token);

  console.log("Simulating 'ACTION_CATALOG' postback...");
  await executeBotAction(mockSenderId, "", "ACTION_CATALOG", token);

  console.log("\n✅ Dispatcher test execution finished without code exceptions.\n");
}

testDispatch();
