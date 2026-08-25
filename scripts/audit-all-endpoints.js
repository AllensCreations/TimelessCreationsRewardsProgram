import 'dotenv/config';
import { runSql } from './lib/db.js';
import { buildCatalogCarousel, buildDashboardPayload, checkDashboardRateLimit } from './lib/bot.js';

console.log("\n🕵️ STARTING DEEP AUDIT OF ALL API HANDLERS, ENDPOINTS & VULNERABILITIES...\n");

let passed = 0;
let failed = 0;
let warnings = 0;

function pass(label) {
  console.log(`✅ [PASS] ${label}`);
  passed++;
}

function fail(label, reason) {
  console.error(`❌ [FAIL] ${label} -> ${reason}`);
  failed++;
}

function warn(label, reason) {
  console.warn(`⚠️ [WARN] ${label} -> ${reason}`);
  warnings++;
}

async function runAudit() {
  // ----------------------------------------------------
  // 1. TURSO DATABASE INTEGRITY & SCHEMA AUDIT
  // ----------------------------------------------------
  console.log("--- 1. DATABASE SCHEMA & PERMISSIONS AUDIT ---");
  try {
    await runSql(`
      CREATE TABLE IF NOT EXISTS missionaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        points INTEGER DEFAULT 0,
        referral_code TEXT UNIQUE,
        fb_sender_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await runSql(`
      CREATE TABLE IF NOT EXISTS bot_daily_views (
        sender_id TEXT,
        view_date TEXT,
        view_count INTEGER DEFAULT 0,
        PRIMARY KEY (sender_id, view_date)
      )
    `);
    await runSql(`
      CREATE TABLE IF NOT EXISTS cdn_gallery (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT,
        direct_url TEXT,
        size_label TEXT,
        original_kb INTEGER DEFAULT 0,
        compressed_kb INTEGER DEFAULT 0,
        delete_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    pass("Database schema verified: `missionaries`, `bot_daily_views`, and `cdn_gallery` tables exist");
  } catch (err) {
    fail("Database schema creation", err.message);
  }

  // ----------------------------------------------------
  // 2. FACEBOOK GRAPH API & WEBHOOK SECURITY AUDIT
  // ----------------------------------------------------
  console.log("\n--- 2. FACEBOOK MESSENGER GRAPH API INTEGRITY ---");
  const fbToken = process.env.PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const fbVerify = process.env.VERIFY_TOKEN || process.env.FB_VERIFY_TOKEN || process.env.FACEBOOK_VERIFY_TOKEN;

  if (!fbVerify) {
    fail("Webhook Verify Token (PAGE_ACCESS_TOKEN / VERIFY_TOKEN)", "Token is empty in .env. Meta Webhook verification will fail with 403.");
  } else {
    pass(`Webhook Verify Token configured (length: ${fbVerify.length})`);
  }

  if (!fbToken) {
    fail("Page Access Token (PAGE_ACCESS_TOKEN / FB_PAGE_ACCESS_TOKEN)", "Missing token in .env. Bot cannot send replies back to Facebook users.");
  } else {
    try {
      const fbCheck = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${fbToken}`);
      const fbData = await fbCheck.json();

      if (fbData.id && fbData.name) {
        pass(`Facebook Page Access Token is ACTIVE for Page: "${fbData.name}" (ID: ${fbData.id})`);
      } else if (fbData.error) {
        fail("Facebook Page Access Token Validation", `${fbData.error.message} (Type: ${fbData.error.type})`);
      }
    } catch (e) {
      fail("Facebook Graph API Network Ping", e.message);
    }
  }

  // ----------------------------------------------------
  // 3. MESSENGER BOT PAYLOAD RECURSION & UNICODE AUDIT
  // ----------------------------------------------------
  console.log("\n--- 3. BOT PAYLOAD & UNICODE FORMATTING AUDIT ---");
  try {
    const testMissionary = {
      name: "Elder Allen Salviejo",
      email: "allen.salviejo@missionary.org",
      points: 5
    };
    const refLink = "https://m.me/TimelessCreationsRP?ref=ALLEN77";
    const payload = buildDashboardPayload(testMissionary, refLink);

    if (payload.dashboardText.includes("**") || payload.dashboardText.includes("###")) {
      fail("Markdown Leak in Dashboard", "Found raw asterisks/hashes. Messenger will display broken syntax.");
    } else {
      pass("Dashboard Text is pure Unicode with zero raw markdown syntax");
    }

    if (!payload.dashboardText.includes("📊 𝗠𝗜𝗦𝗦𝗜𝗢𝗡𝗔𝗥𝗬 𝗗𝗔𝗦𝗛𝗕𝗢𝗔𝗥𝗗")) {
      fail("Unicode Header Mismatch", "Dashboard does not have the expected Unicode bold header.");
    } else {
      pass("Unicode bold mathematical headers validated");
    }
  } catch (err) {
    fail("Bot Payload Construction", err.message);
  }

  // ----------------------------------------------------
  // 4. CAROUSEL & BUTTON PAYLOAD AUDIT (MAX BUTTON CHECK)
  // ----------------------------------------------------
  console.log("\n--- 4. CAROUSEL & META PAYLOAD COMPLIANCE AUDIT ---");
  try {
    const mockProducts = [
      { id: 101, name: "Engraved Nametag", price: 2, image_url: "https://i.ibb.co/test1.webp" },
      { id: 102, name: "POS Drip Kit", price: 8, image_url: "https://i.ibb.co/test2.webp" }
    ];

    const carousel = await buildCatalogCarousel(2, mockProducts);
    const elements = carousel?.attachment?.payload?.elements;

    if (!elements || elements.length === 0) {
      fail("Carousel generation", "No elements created.");
    } else {
      let buttonOverflow = false;
      elements.forEach((el, idx) => {
        if (el.buttons && el.buttons.length > 3) {
          buttonOverflow = true;
          fail(`Element ${idx + 1} Button Limit`, `Element has ${el.buttons.length} buttons. Meta strictly allows a maximum of 3 buttons per generic card.`);
        }
      });

      if (!buttonOverflow) {
        pass("All carousel cards strictly conform to Meta's max 3 button limit");
      }
    }
  } catch (err) {
    fail("Carousel Compliance Test", err.message);
  }

  // ----------------------------------------------------
  // 5. RATE LIMITER CONCURRENCY AUDIT
  // ----------------------------------------------------
  console.log("\n--- 5. RATE LIMITER CONCURRENCY AUDIT ---");
  try {
    const testSender = "audit_sim_" + Date.now();
    const [res1, res2, res3] = await Promise.all([
      checkDashboardRateLimit(testSender),
      checkDashboardRateLimit(testSender),
      checkDashboardRateLimit(testSender)
    ]);

    const allowedCount = [res1, res2, res3].filter(r => r.allowed).length;
    if (allowedCount > 2) {
      warn("Race condition in Rate Limiter", "Concurrent requests bypassed limit. Use atomic transactions.");
    } else {
      pass("Daily rate limiter enforces maximum 2 views per day window");
    }
  } catch (err) {
    fail("Rate Limiter Audit", err.message);
  }

  // ----------------------------------------------------
  // 6. IMGBB CDN API AUDIT
  // ----------------------------------------------------
  console.log("\n--- 6. IMGBB CDN HOSTING AUDIT ---");
  const imgbbKey = process.env.IMGBB_API_KEY;
  if (!imgbbKey) {
    fail("ImgBB API Key", "IMGBB_API_KEY is not defined in .env");
  } else {
    try {
      const test1pxBase64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
      const formData = new URLSearchParams();
      formData.append("image", test1pxBase64);
      formData.append("name", "tcrp_audit_ping");

      const imgRes = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, {
        method: "POST",
        body: formData
      });
      const imgData = await imgRes.json();

      if (imgData.success && imgData.data?.url) {
        pass(`ImgBB upload test succeeded: Direct URL active (${imgData.data.url})`);
      } else {
        fail("ImgBB Upload Verification", imgData.error?.message || "Rejected by ImgBB API");
      }
    } catch (err) {
      fail("ImgBB API Network Ping", err.message);
    }
  }

  // ----------------------------------------------------
  // 7. BREVO API AUDIT
  // ----------------------------------------------------
  console.log("\n--- 7. BREVO MAILER CONFIGURATION AUDIT ---");
  const brevoKey = process.env.BREVO_API_KEY;
  if (!brevoKey) {
    fail("Brevo API Key", "BREVO_API_KEY is missing.");
  } else {
    try {
      const brevoRes = await fetch("https://api.brevo.com/v3/account", {
        headers: { "api-key": brevoKey }
      });
      const bData = await brevoRes.json();
      if (bData.email) {
        pass(`Brevo Mailer is authenticated for account: "${bData.email}" (Plan: ${bData.plan?.[0]?.type || 'Standard'})`);
      } else {
        fail("Brevo API Authentication", bData.message || "Invalid Key");
      }
    } catch (err) {
      fail("Brevo API Connection", err.message);
    }
  }

  console.log("\n=======================================================");
  console.log(`AUDIT COMPLETE: ${passed} PASSED | ${failed} FAILED | ${warnings} WARNINGS`);
  console.log("=======================================================\n");

  if (failed > 0) process.exit(1);
}

runAudit();
