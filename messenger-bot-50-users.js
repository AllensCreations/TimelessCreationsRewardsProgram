// messenger-bot-50-users.js - 50 Concurrent User Load Simulation

import { buildDashboardMessage, buildRewardsCarousel } from './bot-templates.js';

// Simulated Turso DB product_catalog rows
const MOCK_TURSO_CATALOG = [
  { id: 1, name: "Scripture Markers Set", price: 1, image_url: "https://placehold.co/600x400/png?text=Scripture+Markers", type: "reward" },
  { id: 2, name: "Oil Vial Keychain", price: 2, image_url: "https://placehold.co/600x400/png?text=Oil+Vial", type: "reward" },
  { id: 3, name: "Planner & Journal", price: 3, image_url: "https://placehold.co/600x400/png?text=Planner", type: "reward" },
  { id: 4, name: "Custom Name Tag Case", price: 5, image_url: "https://placehold.co/600x400/png?text=Badge+Case", type: "reward" }
];

const TOTAL_USERS = 50;
const results = {
  totalRequests: 0,
  successful: 0,
  failed: 0,
  errors: [],
  responseTimes: []
};

async function simulateUser(userId) {
  const startTime = Date.now();
  const psid = `PSID_USER_${userId.toString().padStart(3, '0')}`;
  
  try {
    // 1. Simulate DB query for user profile
    const userData = {
      psid,
      name: `Elder / Sister #${userId}`,
      status: userId % 2 === 0 ? "Linked & Active" : "Not linked yet",
      points: Math.floor(Math.random() * 10),
      refCode: `REF${userId}XYZ`
    };

    // 2. Generate Dashboard Payload
    const dashboardPayload = buildDashboardMessage(userData);
    if (!dashboardPayload.text.includes("MISSIONARY DASHBOARD")) {
      throw new Error(`[User ${userId}] Dashboard template failed generation.`);
    }

    // 3. Generate Rewards Carousel Payload from Turso Catalog
    const carouselPayload = buildRewardsCarousel(MOCK_TURSO_CATALOG);
    if (!carouselPayload.attachment || carouselPayload.attachment.payload.elements.length !== 4) {
      throw new Error(`[User ${userId}] Carousel elements corrupted or length mismatch.`);
    }

    // 4. Simulate simulated payload size check (Messenger limit: 20KB per message payload)
    const payloadSize = Buffer.byteLength(JSON.stringify(carouselPayload), 'utf8');
    if (payloadSize > 20480) {
      throw new Error(`[User ${userId}] Payload size ${payloadSize} exceeds Messenger 20KB limit.`);
    }

    // 5. Artificial network / DB I/O delay (jitter: 50ms - 300ms)
    await new Promise((res) => setTimeout(res, 50 + Math.random() * 250));

    const duration = Date.now() - startTime;
    results.responseTimes.push(duration);
    results.successful++;
  } catch (err) {
    results.failed++;
    results.errors.push({ userId, error: err.message });
  } finally {
    results.totalRequests++;
  }
}

async function runSimulation() {
  console.log(`🚀 Starting load simulation with ${TOTAL_USERS} concurrent users...\n`);
  const startAll = Date.now();

  // Fire 50 user operations in parallel
  await Promise.all(
    Array.from({ length: TOTAL_USERS }, (_, i) => simulateUser(i + 1))
  );

  const totalTime = Date.now() - startAll;
  const avgTime = results.responseTimes.reduce((a, b) => a + b, 0) / (results.responseTimes.length || 1);
  const minTime = Math.min(...results.responseTimes);
  const maxTime = Math.max(...results.responseTimes);

  console.log("================ SIMULATION REPORT ================");
  console.log(`Total Simulated Users:  ${results.totalRequests}`);
  console.log(`Successful Operations:  ${results.successful}`);
  console.log(`Failed Operations:      ${results.failed}`);
  console.log(`Total Execution Time:   ${totalTime}ms`);
  console.log(`Average Latency:        ${avgTime.toFixed(2)}ms`);
  console.log(`Fastest / Slowest:      ${minTime}ms / ${maxTime}ms`);

  if (results.errors.length > 0) {
    console.log("\n❌ Errors Encountered:");
    results.errors.forEach((e) => console.log(` - User ${e.userId}: ${e.error}`));
  } else {
    console.log("\n✅ All 50 user requests constructed and validated with zero template errors.");
  }
  console.log("===================================================\n");
}

runSimulation();
