/**
 * TCRP Google Apps Script (GAS) Auto-Install & Email Dispatch Engine
 * 
 * ZERO MANUAL CODE EDITING REQUIRED:
 * - Run INSTALL() once in the editor (or open the Web App URL in your browser)
 * - That's it! It automatically sets up 7am, 8am, and 9am morning triggers,
 *   manages quota safety, and handles both batch waves and instant transactional emails.
 */

// ============================================================================
// 1. ONE-CLICK INSTALL / SETUP SHORTCUT (Run this in the Apps Script Editor!)
// ============================================================================
function INSTALL() {
  setupTriggers();
  var quota = MailApp.getRemainingDailyQuota();
  Logger.log("==========================================================");
  Logger.log("✅ TCRP EMAIL ENGINE INSTALLED SUCCESSFULLY!");
  Logger.log("📅 Triggers Active: 7:00 AM (27), 8:00 AM (27), and 9:00 AM (26) daily");
  Logger.log("🎯 Daily Batch Sends: 80 max (20 strictly reserved for transactional/OTP/receipts)");
  Logger.log("📬 Gmail Daily Quota: " + quota + " emails remaining");
  Logger.log("💡 You can also open your deployed Web App URL in a browser");
  Logger.log("   for the interactive 1-click Control Dashboard!");
  Logger.log("==========================================================");
}

function UNINSTALL() {
  clearAllTriggers();
  Logger.log("🛑 All TCRP triggers removed.");
}

// ============================================================================
// 2. CONFIGURATION STORAGE (Saved in Script Properties - No Code Edits Needed)
// ============================================================================
function getConfig() {
  var props = PropertiesService.getScriptProperties();
  return {
    vercelUrl: props.getProperty("VERCEL_BASE_URL") || "https://timelesscreationsrewardsprogram.vercel.app",
    adminSecret: props.getProperty("ADMIN_SECRET") || "tcrp-clean-2026",
    senderName: props.getProperty("SENDER_NAME") || "Timeless Creations Rewards"
  };
}

function setConfig(vercelUrl, adminSecret, senderName) {
  var props = PropertiesService.getScriptProperties();
  if (vercelUrl) props.setProperty("VERCEL_BASE_URL", vercelUrl.trim().replace(/\/+$/, ""));
  if (adminSecret) props.setProperty("ADMIN_SECRET", adminSecret.trim());
  if (senderName) props.setProperty("SENDER_NAME", senderName.trim());
}

// ============================================================================
// 3. WEB DASHBOARD & HTTP API (doGet)
// ============================================================================
function doGet(e) {
  // If called as an API endpoint (e.g., from cron-job.org or external trigger)
  if (e && e.parameter && (e.parameter.action === "run_wave" || e.parameter.limit)) {
    var limit = Number(e.parameter.limit) || 30;
    var res = runMorningWave(limit);
    return ContentService.createTextOutput(JSON.stringify(res))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Handle configuration save from the Web Setup Dashboard
  if (e && e.parameter && e.parameter.save_config === "true") {
    setConfig(e.parameter.vercel_url, e.parameter.admin_secret, e.parameter.sender_name);
    setupTriggers();
  }

  // Handle instant test email trigger from the dashboard
  var testResult = "";
  if (e && e.parameter && e.parameter.test_email) {
    try {
      var cfg = getConfig();
      GmailApp.sendEmail(e.parameter.test_email, "🧪 TCRP Email Test", "", {
        name: cfg.senderName,
        htmlBody: "<div style='font-family:sans-serif;padding:20px;background:#f9f6f0;border-radius:8px;'><h2 style='color:#b8955a;'>🎉 TCRP Email Dispatcher Working!</h2><p>Your Google Apps Script email engine is active and successfully connected to your personal Gmail account.</p></div>"
      });
      testResult = "✅ Test email successfully sent to " + e.parameter.test_email;
    } catch (err) {
      testResult = "❌ Error sending test email: " + err.message;
    }
  }

  // Render the interactive 1-Click Setup & Control Web Dashboard
  return HtmlService.createHtmlOutput(renderDashboardHtml(testResult))
    .setTitle("TCRP Mailer • Control Dashboard")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ============================================================================
// 4. INSTANT DISPATCHER (doPost for OTP codes, receipts, and Vercel calls)
// ============================================================================
function doPost(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return jsonResponse({ ok: false, error: "Service busy, please retry in a moment." });
  }

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: "Missing request body." });
    }

    var data = JSON.parse(e.postData.contents);
    var cfg = getConfig();

    // Trigger morning wave on demand
    if (data.action === "trigger_wave" || data.action === "run_cron") {
      var waveResult = runMorningWave(Number(data.limit) || 30);
      return jsonResponse(waveResult);
    }

    // Single instant email dispatch (OTP, Receipt, Test)
    var to = data.to;
    var subject = data.subject || "Notification";
    var htmlContent = data.htmlContent || "";
    var name = data.senderName || cfg.senderName;

    if (!to) return jsonResponse({ ok: false, error: "Missing recipient 'to' parameter." });

    var remaining = MailApp.getRemainingDailyQuota();
    if (remaining <= 1) {
      return jsonResponse({ ok: false, error: "Daily Gmail limit reached (" + remaining + " remaining)." });
    }

    GmailApp.sendEmail(to, subject, "", {
      name: name,
      htmlBody: htmlContent
    });

    return jsonResponse({ ok: true, sentTo: to, remainingQuota: remaining - 1 });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// 5. BATCH WAVE DISPATCHER (Runs locally in GAS runtime - No Vercel Timeouts)
// ============================================================================
// Max batch drip sends per day: 80 (with 20 strictly reserved for transactional/OTPs)
var RESERVED_FOR_OTHER = 20;

function runMorningWave(batchLimit) {
  var requestedLimit = batchLimit || 27;
  var cfg = getConfig();
  var quota = MailApp.getRemainingDailyQuota();

  // Enforce reserve of 20 emails for transactional / OTP / receipt / other
  if (quota <= RESERVED_FOR_OTHER) {
    Logger.log("Skipping batch wave: quota is " + quota + " remaining (reserving at least " + RESERVED_FOR_OTHER + " for OTPs & transactional emails).");
    return { ok: false, error: "Batch drip limit reached. Preserving " + quota + " remaining sends for OTP and transactional emails." };
  }

  // Adjust limit if batch would cut into the 20-email reserve
  var maxAvailableForBatch = quota - RESERVED_FOR_OTHER;
  var limit = Math.min(requestedLimit, maxAvailableForBatch);

  // Step A: Ultra-fast pull from Vercel (< 300ms)
  var fetchUrl = cfg.vercelUrl + "/api/main?action=get_cron_batch&limit=" + limit;
  var response;
  try {
    response = UrlFetchApp.fetch(fetchUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json", "x-admin-key": cfg.adminSecret },
      muteHttpExceptions: true
    });
  } catch (err) {
    return { ok: false, error: "Cannot connect to Vercel: " + err.toString() };
  }

  if (response.getResponseCode() !== 200) {
    return { ok: false, error: "Vercel HTTP " + response.getResponseCode() + ": " + response.getContentText() };
  }

  var batchData;
  try {
    batchData = JSON.parse(response.getContentText());
  } catch (e) {
    return { ok: false, error: "Failed to parse Vercel response JSON" };
  }

  if (!batchData.ok || !batchData.batch || batchData.batch.length === 0) {
    return { ok: true, sentCount: 0, message: batchData.message || "No emails due in this window." };
  }

  var items = batchData.batch;
  var successful = [];
  var failed = [];

  // Step B: Send emails in GAS (GAS runtime allows up to 6 minutes!)
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    // Strictly preserve at least 20 sends for other uses
    if (MailApp.getRemainingDailyQuota() <= RESERVED_FOR_OTHER) {
      Logger.log("Halting batch: reached reserve threshold (" + RESERVED_FOR_OTHER + " emails remaining).");
      break;
    }

    try {
      GmailApp.sendEmail(item.to, item.subject, "", {
        name: cfg.senderName,
        htmlBody: item.htmlContent
      });

      successful.push({
        email: item.to,
        name: item.name,
        targetCalMonth: item.targetCalMonth,
        tenureMonth: item.tenureMonth
      });

      Utilities.sleep(250); // Small pause for smooth sending
    } catch (sendErr) {
      failed.push({ email: item.to, error: sendErr.toString() });
    }
  }

  // Step C: Ultra-fast confirmation to Vercel (< 150ms)
  if (successful.length > 0) {
    try {
      UrlFetchApp.fetch(cfg.vercelUrl + "/api/main", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": cfg.adminSecret },
        payload: JSON.stringify({ action: "confirm_cron_batch", successful: successful }),
        muteHttpExceptions: true
      });
    } catch (updateErr) {
      Logger.log("Vercel confirmation error: " + updateErr);
    }
  }

  return {
    ok: true,
    sentCount: successful.length,
    failedCount: failed.length,
    remainingQuota: MailApp.getRemainingDailyQuota()
  };
}

// ============================================================================
// 6. TRIGGER MANAGEMENT (7:00, 8:00, and 9:00 AM Daily)
// ============================================================================
function setupTriggers() {
  clearAllTriggers();

  ScriptApp.newTrigger("runWave7am").timeBased().everyDays(1).atHour(7).create();
  ScriptApp.newTrigger("runWave8am").timeBased().everyDays(1).atHour(8).create();
  ScriptApp.newTrigger("runWave9am").timeBased().everyDays(1).atHour(9).create();
}

function clearAllTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn.indexOf("runWave") === 0 || fn.indexOf("triggerWave") === 0) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

// 27 + 27 + 26 = 80 daily batch sends total (leaving exactly 20 for OTPs / other)
function runWave7am() { runMorningWave(27); }
function runWave8am() { runMorningWave(27); }
function runWave9am() { runMorningWave(26); }

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// 7. DASHBOARD HTML UI
// ============================================================================
function renderDashboardHtml(notice) {
  var cfg = getConfig();
  var quota = MailApp.getRemainingDailyQuota();
  var triggers = ScriptApp.getProjectTriggers().map(function(t) { return t.getHandlerFunction(); }).join(", ") || "None";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>TCRP Mailer Control Dashboard</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background:#12100d; color:#e0dcd3; margin:0; padding:24px; }
    .container { max-width: 580px; margin: 0 auto; background: #1c1813; border: 1px solid #33281a; border-radius: 12px; padding: 28px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    h1 { color: #d4b07a; font-size: 1.4rem; margin-top:0; border-bottom: 1px solid #33281a; padding-bottom: 14px; }
    .badge { display:inline-block; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: bold; background: #2c2214; color: #d4b07a; border: 1px solid #5a4525; margin-right: 6px; }
    .quota-box { background: #251e16; border: 1px solid #4a381f; border-radius: 8px; padding: 14px; margin: 18px 0; display:flex; justify-content:space-between; align-items:center; }
    .quota-num { font-size: 1.5rem; font-weight: bold; color: #4ade80; }
    label { display:block; font-size: 0.82rem; color: #a89f91; margin-top: 14px; margin-bottom: 5px; }
    input { width: 100%; box-sizing: border-box; background: #12100d; border: 1px solid #3d3223; color: #fff; padding: 10px; border-radius: 6px; font-size: 0.9rem; }
    input:focus { outline: none; border-color: #d4b07a; }
    .btn { display:inline-block; width:100%; background: #d4b07a; color: #12100d; font-weight: bold; padding: 12px; border:none; border-radius: 6px; cursor: pointer; font-size: 0.95rem; margin-top: 18px; transition: 0.2s; }
    .btn:hover { background: #e5c38e; }
    .btn-secondary { background: #2a2217; color: #d4b07a; border: 1px solid #5a4525; margin-top: 10px; }
    .btn-secondary:hover { background: #3d3020; }
    .notice { padding: 12px; border-radius: 6px; background: #2a2217; border: 1px solid #d4b07a; color: #d4b07a; margin-bottom: 18px; font-size: 0.88rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📬 TCRP Email Engine Dashboard</h1>
    ${notice ? `<div class="notice">${notice}</div>` : ''}
    
    <div class="quota-box">
      <div>
        <div style="font-size:0.8rem; color:#a89f91;">DAILY GMAIL QUOTA REMAINING</div>
        <div style="font-size:0.75rem; color:#888;">Cap: 80 batch drips/day (20 strictly reserved for transactional/OTPs)</div>
      </div>
      <div class="quota-num">${quota} <span style="font-size:0.9rem; color:#888;">/ 100</span></div>
    </div>

    <div>
      <span class="badge">⏰ Triggers: 7:00 (27), 8:00 (27), 9:00 (26) AM</span>
      <span class="badge">🛡️ 20 Reserved for OTPs/Receipts</span>
      <span class="badge">⚡ Timeout-Immune</span>
    </div>

    <form method="GET" action="">
      <input type="hidden" name="save_config" value="true">
      
      <label>Vercel Backend URL</label>
      <input type="text" name="vercel_url" value="${cfg.vercelUrl}" required>

      <label>Admin Secret Key</label>
      <input type="text" name="admin_secret" value="${cfg.adminSecret}">

      <label>Sender Display Name</label>
      <input type="text" name="sender_name" value="${cfg.senderName}">

      <button type="submit" class="btn">💾 Save & Auto-Activate Daily Triggers</button>
    </form>

    <hr style="border:0; border-top:1px solid #33281a; margin: 24px 0;">

    <form method="GET" action="">
      <label>Send a Quick Diagnostic Test Email</label>
      <input type="email" name="test_email" placeholder="your-email@gmail.com" required>
      <button type="submit" class="btn btn-secondary">🧪 Dispatch Test Email Now</button>
    </form>
  </div>
</body>
</html>`;
}
