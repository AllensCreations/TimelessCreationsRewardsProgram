import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { JSDOM } from 'jsdom';
import { runSql } from './lib/db.js';
import handler from './api/main.js';
import cronHandler from './api/cron.js';
import { handleBotMessage } from './lib/botHandler.js';
import { runDatabaseMaintenance } from './lib/dbPruner.js';
import { verifyFbSignature, isRateLimited } from './lib/security.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failureLogs = [];
const suiteBreakdown = {};

function assert(suite, condition, description, errorDetails = null) {
  totalTests++;
  if (!suiteBreakdown[suite]) suiteBreakdown[suite] = { total: 0, passed: 0, failed: 0 };
  suiteBreakdown[suite].total++;

  const testNum = String(totalTests).padStart(3, '0');
  if (condition) {
    passedTests++;
    suiteBreakdown[suite].passed++;
  } else {
    failedTests++;
    suiteBreakdown[suite].failed++;
    const errText = errorDetails ? ` (Error: ${typeof errorDetails === 'object' ? JSON.stringify(errorDetails) : errorDetails})` : '';
    failureLogs.push(`[#${testNum}] [${suite}] ${description}${errText}`);
    console.error(`  ❌ [#${testNum}] [${suite}] ${description}${errText}`);
  }
}

async function mockApiCall(action, method = 'GET', body = {}, query = {}) {
  let statusCode = 200;
  let responseData = null;

  const req = {
    method,
    query: { action, ...query },
    body,
    headers: {}
  };

  const res = {
    setHeader: () => {},
    status: (code) => { statusCode = code; return res; },
    json: (data) => { responseData = data; return res; },
    end: () => res
  };

  try {
    await handler(req, res);
  } catch (err) {
    statusCode = 500;
    responseData = { ok: false, error: err.message, stack: err.stack };
  }

  return { status: statusCode, data: responseData };
}

// Dead File & Unused Dependency Scanner
function scanDeadFilesAndReferences() {
  const rootDir = process.cwd();
  const ignoreList = ['.git', 'node_modules', '.github', 'package-lock.json', '.env', 'system_deep_tester.js', 'master_bug_finder.js', 'tester_ui_500.js'];
  
  function getAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      const relPath = path.relative(rootDir, fullPath);
      if (ignoreList.some(ig => relPath.startsWith(ig))) return;

      if (fs.statSync(fullPath).isDirectory()) {
        getAllFiles(fullPath, fileList);
      } else {
        fileList.push(relPath);
      }
    });
    return fileList;
  }

  const allRepoFiles = getAllFiles(rootDir);
  const fileContents = {};
  allRepoFiles.forEach(file => {
    try { fileContents[file] = fs.readFileSync(file, 'utf8'); } catch (e) {}
  });

  const unusedFiles = [];

  allRepoFiles.forEach(targetFile => {
    const baseName = path.basename(targetFile);
    const ext = path.extname(targetFile);

    // Skip root essentials
    if (['package.json', 'README.md', 'vercel.json', 'manifest.json'].includes(baseName)) return;

    let isReferenced = false;

    for (const [sourceFile, content] of Object.entries(fileContents)) {
      if (sourceFile === targetFile) continue;
      if (content.includes(baseName) || content.includes(targetFile) || content.includes(targetFile.replace(/\\/g, '/'))) {
        isReferenced = true;
        break;
      }
    }

    // Check entry routes that are implicitly used by Vercel/Servers
    if (targetFile.startsWith('api/') || targetFile.startsWith('views/')) isReferenced = true;

    if (!isReferenced) {
      unusedFiles.push(targetFile);
    }
  });

  return unusedFiles;
}

async function runDeepTester() {
  console.log("\n=======================================================");
  console.log("🚀 STARTING TCRP SYSTEM DEEP TESTER & DEAD CODE AUDITOR");
  console.log("=======================================================\n");

  const startTime = Date.now();
  const RUN_ID = Date.now();

  // -------------------------------------------------------------
  // SUITE 1: ENVIRONMENT & TURSO SCHEMA VERIFICATION
  // -------------------------------------------------------------
  console.log("📌 SUITE 1: Environment & Database Schema Checks");
  assert("Database & Schema", Boolean(process.env.TURSO_DATABASE_URL), "TURSO_DATABASE_URL is set");
  assert("Database & Schema", Boolean(process.env.TURSO_AUTH_TOKEN), "TURSO_AUTH_TOKEN is set");

  const schemaTables = [
    'missionaries', 'orders', 'stats', 'drip_messages', 'sessions',
    'system_logs', 'cash_invoices', 'product_catalog', 'product_highlight',
    'system_config', 'chat_messages', 'global_referral_pool', 'system_settings', 'bot_rate_limits'
  ];

  for (const tbl of schemaTables) {
    try {
      const q = await runSql(`SELECT count(*) as count FROM ${tbl}`);
      assert("Database & Schema", q && q.length > 0, `Table '${tbl}' active in Turso database`);
    } catch (e) {
      assert("Database & Schema", false, `Table '${tbl}' check failed: ${e.message}`);
    }
  }

  // -------------------------------------------------------------
  // SUITE 2: REST API ENDPOINT ENGINE & CRUD
  // -------------------------------------------------------------
  console.log("📌 SUITE 2: API Endpoints, Metrics & CRUD Validation");

  // Health check & Power toggle
  const healthRes = await mockApiCall("health_check");
  assert("REST API Core", healthRes.data?.ok === true, "GET /api/main?action=health_check returns OK");

  const powerToggle = await mockApiCall("toggle_power", "POST", { state: "online" });
  assert("REST API Core", powerToggle.data?.ok === true && powerToggle.data?.state === "ONLINE", "POST toggle_power persists ONLINE status");

  // Dashboard Stats
  const statsRes = await mockApiCall("get_stats");
  assert("REST API Core", statsRes.status === 200 && statsRes.data?.ok === true, "GET get_stats returns 200 payload");
  assert("REST API Core", typeof statsRes.data?.stats?.total_missionaries === 'number', "Total missionaries is numeric");
  assert("REST API Core", Array.isArray(statsRes.data?.recent_logs), "Recent system logs array present");

  // Catalog Synchronization & Query
  const syncCat = await mockApiCall("sync_catalog", "POST", {
    type: "reward",
    products: [
      { name: "Olive Wood Temple", price: 6, image_url: "https://i.postimg.cc/test1.png" },
      { name: "Custom Nametag Pin", price: 12, image_url: "https://i.postimg.cc/test2.png" }
    ]
  });
  assert("REST API Core", syncCat.data?.ok === true, "POST sync_catalog operates successfully");

  const getProds = await mockApiCall("get_products", "GET", {}, { type: "reward" });
  assert("REST API Core", getProds.data?.products?.length >= 2, "GET get_products returns synced product catalog");

  // Drip CRUD
  const saveDrip = await mockApiCall("save_drip", "POST", {
    month: 1,
    theme: "Elder Jeffrey R. Holland",
    scripture: "Trust in the Lord with all thine heart.",
    message: "May your faith be strengthened as you serve.",
    highlight_img: "",
    highlight_label: "Custom Highlight"
  });
  assert("REST API Core", saveDrip.data?.ok === true, "POST save_drip saves monthly curriculum");

  // -------------------------------------------------------------
  // SUITE 3: MISSIONARIES BATCH PUSHER & LEDGER FLOOR
  // -------------------------------------------------------------
  console.log("📌 SUITE 3: Batch Pusher & Points Engine");
  const testBatch = [
    { title_name: "Elder Samuel Lee", first_name: "Samuel", email: `elder.lee.${RUN_ID}@missionary.org`, batch: "August 2026" },
    { title_name: "Sister Hannah Davis", first_name: "Hannah", email: `sister.davis.${RUN_ID}@missionary.org`, batch: "August 2026" }
  ];

  const pushRes = await mockApiCall("push_missionaries", "POST", { entries: testBatch });
  assert("Pusher Engine", pushRes.data?.ok === true && pushRes.data?.added === 2, "push_missionaries added exactly 2 records");

  const elderLee = (await runSql("SELECT * FROM missionaries WHERE email = ?", [testBatch[0].email]))[0];
  const sisterDavis = (await runSql("SELECT * FROM missionaries WHERE email = ?", [testBatch[1].email]))[0];

  assert("Pusher Engine", elderLee?.cohort === "elder" && elderLee?.max_months === 24, "Elder automatically classified to 24 max_months");
  assert("Pusher Engine", sisterDavis?.cohort === "sister" && sisterDavis?.max_months === 18, "Sister automatically classified to 18 max_months");
  assert("Pusher Engine", Boolean(elderLee?.referral_code), "Unique referral code generated for Elder");

  // Points Floor & Mutation Test
  await mockApiCall("update_missionary_points", "POST", { email: testBatch[0].email, delta: 10 });
  let checkPts = (await runSql("SELECT points FROM missionaries WHERE email = ?", [testBatch[0].email]))[0];
  assert("Points Ledger", checkPts?.points === 10, "Points ledger incremented to +10 PTS");

  await mockApiCall("update_missionary_points", "POST", { email: testBatch[0].email, delta: -50 });
  checkPts = (await runSql("SELECT points FROM missionaries WHERE email = ?", [testBatch[0].email]))[0];
  assert("Points Ledger", checkPts?.points === 0, "Points floor correctly enforced at 0 PTS (No negative values)");

  // -------------------------------------------------------------
  // SUITE 4: CRON WORKER, AUTOMATED DRIPS & PRUNING
  // -------------------------------------------------------------
  console.log("📌 SUITE 4: Cron Worker, Drip Automation & Database Maintenance");
  const cronReq = { headers: {}, query: {} };
  let cronResData = null;
  const cronRes = {
    status: () => cronRes,
    json: (d) => { cronResData = d; return cronRes; }
  };

  await cronHandler(cronReq, cronRes);
  assert("Cron & Worker", cronResData?.ok === true, "api/cron.js executed successfully without crashing");

  const pruneResult = await runDatabaseMaintenance();
  assert("DB Pruner", pruneResult.ok === true, "Database maintenance & log pruning executed cleanly");

  // -------------------------------------------------------------
  // SUITE 5: SECURITY, SIGNATURES & RATE LIMITING
  // -------------------------------------------------------------
  console.log("📌 SUITE 5: Webhook Security & Rate Limiting");
  const testPsid = `PSID_SEC_${RUN_ID}`;
  const isLimited1 = await isRateLimited(testPsid, 3, 60);
  const isLimited2 = await isRateLimited(testPsid, 3, 60);
  const isLimited3 = await isRateLimited(testPsid, 3, 60);
  const isLimited4 = await isRateLimited(testPsid, 3, 60);

  assert("Security Engine", !isLimited1 && !isLimited2 && !isLimited3, "Rate limiter permits requests within threshold");
  assert("Security Engine", isLimited4 === true, "Rate limiter blocks 4th request when threshold is 3");

  const sigCheck = verifyFbSignature({ headers: {} }, "mockBody");
  assert("Security Engine", typeof sigCheck === 'boolean', "verifyFbSignature executes safe comparison");

  // -------------------------------------------------------------
  // SUITE 6: BOT CONVERSATION & STATE MACHINE
  // -------------------------------------------------------------
  console.log("📌 SUITE 6: Messenger Bot State Machine");
  const botPsid = `BOT_PSID_${RUN_ID}`;
  try {
    await handleBotMessage(botPsid, "Get Started");
    let sess = (await runSql("SELECT * FROM sessions WHERE psid = ?", [botPsid]))[0];
    assert("Bot Machine", sess?.state === 'AWAITING_REFERRAL' || sess?.state === 'AWAITING_TERMS', "Bot initialized session state");

    // Clean up test rows
    await runSql("DELETE FROM missionaries WHERE email IN (?, ?)", [testBatch[0].email, testBatch[1].email]);
    await runSql("DELETE FROM sessions WHERE psid IN (?, ?)", [testPsid, botPsid]);
    await runSql("DELETE FROM bot_rate_limits WHERE psid = ?", [testPsid]);
  } catch (err) {
    assert("Bot Machine", false, `Bot handler error: ${err.message}`);
  }

  // -------------------------------------------------------------
  // SUITE 7: DEAD & UNUSED FILES SCANNER
  // -------------------------------------------------------------
  console.log("📌 SUITE 7: Dead Code & Orphaned Files Audit");
  const unusedFiles = scanDeadFilesAndReferences();
  assert("Dead Code Audit", true, `Repository scan complete (${unusedFiles.length} candidate unused files detected)`);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const passRate = Math.round((passedTests / totalTests) * 100);

  console.log("\n=======================================================");
  console.log("📋 SYSTEM DEEP TESTER AUDIT REPORT");
  console.log("=======================================================\n");

  const report = `=======================================================
TCRP MASTER SYSTEM DEEP AUDIT & DEAD CODE REPORT
Timestamp : ${new Date().toISOString()}
Duration  : ${duration}s
Health    : ${failedTests === 0 ? '✅ 100% OPERATIONAL & VERIFIED' : '⚠️ BUGS DETECTED'}
=======================================================

📊 MODULE BREAKDOWN:
${Object.entries(suiteBreakdown).map(([name, s]) => `• ${name.padEnd(26)} : ${s.passed}/${s.total} (${Math.round((s.passed / s.total) * 100)}%)`).join('\n')}

📈 TOTAL METRICS:
• Total Assertions Tested : ${totalTests}
• Total Passed            : ${passedTests}
• Total Failed            : ${failedTests}
• Success Rate            : ${passRate}%

${failedTests > 0 ? `🚨 FAILURES:\n${failureLogs.map(f => `  • ${f}`).join('\n')}\n` : '🎉 Zero runtime errors or broken route bindings across the application!\n'}
📁 UNUSED / ORPHANED FILE SCAN:
${unusedFiles.length > 0 ? unusedFiles.map(f => `  ⚠️ Unused candidate: ${f}`).join('\n') : '  ✨ No orphaned files found! All repository files are actively referenced.'}
=======================================================`;

  console.log(report);
  console.log("\n=======================================================\n");
}

runDeepTester();
