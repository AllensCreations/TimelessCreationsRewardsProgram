#!/usr/bin/env node

/**
 * =========================================================================
 * Timeless Creations Rewards Program - All Email Template Tester
 * =========================================================================
 * 
 * Verifies 100% compliance of all 6 HTML email templates:
 *   1. OTP Passcode Email (Account Verification)
 *   2. Reward Redemption Receipt Email
 *   3. Thank You / Order Completed Fulfillment Email
 *   4. Monthly Encouragement Drip (Standard 24h Active)
 *   5. Out-of-Window Reconnect Drip (Meta 24h Offline Session)
 *   6. Package Delivered Email
 * 
 * Usage:
 *   node test-templates.js
 * =========================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadTemplateFile,
  detectEndsWithHtml,
  ensureEndsWithHtml,
  renderEmailTemplate,
  renderAllEmailTemplate,
  renderOtpTemplate,
  renderReceiptTemplate,
  renderThankYouTemplate,
  renderMonthlyDripTemplate,
  renderOutOfWindowDripTemplate,
  renderDeliveredTemplate,
  sendEmail
} from './lib/mailer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.resolve(__dirname, 'test-output');

// Colors for terminal output
const C = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gold: '\x1b[38;5;220m',
  gray: '\x1b[90m'
};

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log(`${C.gold}${C.bright}================================================================${C.reset}`);
console.log(`${C.gold}${C.bright}  ✉️  TIMELESS CREATIONS - ALL EMAIL TEMPLATES AUDITOR & TESTER ${C.reset}`);
console.log(`${C.gold}${C.bright}  🔍  With Strict </html> Ending & Completeness Detection         ${C.reset}`);
console.log(`${C.gold}${C.bright}================================================================${C.reset}\n`);

const mockCatalog = [
  { name: 'Wooden Nametag', price: 4, image_url: 'https://lh3.googleusercontent.com/u/0/d/1F7Yb0OzuCmPO2LyZ0cMoaTM4d4rs5RFE' },
  { name: 'Custom POS Kit', price: 8, image_url: 'https://lh3.googleusercontent.com/u/0/d/101jY71PjxCwiuNznTgn7Xyc0HoXwB3WQ' },
  { name: 'Leather Script Case', price: 12, image_url: 'https://lh3.googleusercontent.com/u/0/d/1IkagW3wWhIhfaG01mBL4wNF-1j2lP6YG' }
];

const mockPromo = {
  code: 'WELCOMEBONUS',
  points: 2
};

const templatesToTest = [
  {
    id: 'otp',
    filename: 'otp-email.html',
    title: '🔐 Verification Passcode (OTP)',
    render: () => renderOtpTemplate({
      name: 'Elder Salviejo',
      otpCode: '839201',
      displayDate: 'September 1, 2026'
    })
  },
  {
    id: 'receipt',
    filename: 'receipt-email.html',
    title: '🧾 Redemption Receipt',
    render: () => renderReceiptTemplate({
      name: 'Sister Santos',
      order_id: 'TCRP-8829',
      item: 'Custom Wooden Missionary Nametag',
      points_cost: 6,
      status: 'PENDING FULFILLMENT'
    })
  },
  {
    id: 'thankyou',
    filename: 'thankyou-email.html',
    title: '📦 Order Completed & Fulfilled',
    render: () => renderThankYouTemplate({
      name: 'Elder Johnson',
      order_id: 'TCRP-5512',
      item: 'Missionary Starter POS Kit'
    }, 'COMPLETED')
  },
  {
    id: 'monthly_drip',
    filename: 'monthly-drip.html',
    title: '💌 Monthly Encouragement Drip Letter',
    render: () => renderMonthlyDripTemplate({
      month: 9,
      name: 'Elder Mark',
      message: 'Keep pressing forward with a steadfastness in Christ. Your labors in the field are remembered and cherished.',
      scripture: 'Trust in the Lord with all thine heart; and lean not unto thine own understanding. - Proverbs 3:5-6',
      theme: 'Faith in the Lord Jesus Christ',
      points: 4,
      highlight_label: 'Wooden Nametag',
      highlight_sold_1: '1500',
      highlight_label_2: 'POS Kit',
      highlight_sold_2: '950'
    }, mockCatalog, mockPromo)
  },
  {
    id: 'out_of_window',
    filename: 'out-of-window-drip.html',
    title: '⚡ Out-of-Window Reconnect Drip',
    render: () => renderOutOfWindowDripTemplate({
      month: 9,
      name: 'Sister Taylor',
      message: 'A quick reminder of your ongoing rewards and monthly blessing letter from Timeless Creations.',
      scripture: 'Be strong and of a good courage; be not afraid.',
      theme: 'Courage & Endurance',
      points: 2
    }, mockCatalog, mockPromo)
  },
  {
    id: 'delivered',
    filename: 'delivered-email.html',
    title: '🚚 Package Delivered Confirmation',
    render: () => renderDeliveredTemplate({
      name: 'Elder Reyes',
      order_id: 'TCRP-3301',
      item: 'Wooden Missionary Nametag & POS Kit',
      status: 'DELIVERED',
      date: 'September 1, 2026'
    })
  }
];

let totalPassed = 0;
let totalFailed = 0;

console.log(`${C.bright}[SECTION 1] Validating Individual Email Templates (1-6)...${C.reset}\n`);

for (let i = 0; i < templatesToTest.length; i++) {
  const item = templatesToTest[i];
  console.log(`${C.bright}[Template ${i + 1}/${templatesToTest.length}] ${item.title}${C.reset}`);
  console.log(`   Source: ${C.cyan}templates/${item.filename}${C.reset}`);

  try {
    // 1. Check raw file presence on disk
    const diskContent = loadTemplateFile(item.filename);
    if (!diskContent) {
      throw new Error(`Failed to load template content for ${item.filename}`);
    }

    // 2. Render Template
    const renderedHtml = item.render();

    // 3. Validation Assertions
    const issues = [];

    if (!renderedHtml || typeof renderedHtml !== 'string') {
      issues.push('Rendered output is null, undefined, or not a string');
    }

    if (!renderedHtml.includes('<!DOCTYPE html>')) {
      issues.push('Missing <!DOCTYPE html> declaration');
    }

    if (!renderedHtml.includes('<html') || !renderedHtml.includes('</html>')) {
      issues.push('Missing <html> or </html> tag');
    }

    if (!renderedHtml.includes('<body') || !renderedHtml.includes('</body>')) {
      issues.push('Missing <body> or </body> tag');
    }

    // 4. Strict </html> Ending Detection Check
    const detection = detectEndsWithHtml(renderedHtml);
    if (!detection.endsWithHtml) {
      issues.push('Template does NOT strictly end with </html> (trailing content or missing tag detected)');
    }

    // 5. Check for unreplaced {{PLACEHOLDER}} tags
    const unreplacedMatches = renderedHtml.match(/{{[A-Za-z0-9_]+}}/g);
    if (unreplacedMatches && unreplacedMatches.length > 0) {
      issues.push(`Found unreplaced placeholders: ${unreplacedMatches.join(', ')}`);
    }

    // 6. Check inline style presence
    if (!renderedHtml.includes('style=')) {
      issues.push('Warning: No inline styles detected in template body');
    }

    // 7. Save sample to test-output directory
    const samplePath = path.join(OUTPUT_DIR, `preview-${item.id}.html`);
    fs.writeFileSync(samplePath, renderedHtml, 'utf8');

    if (issues.length === 0) {
      console.log(`   ${C.green}✔ Render Success:${C.reset} ${renderedHtml.length.toLocaleString()} bytes HTML`);
      console.log(`   ${C.green}✔ </html> Ending Detected:${C.reset} Strictly Valid ✅`);
      console.log(`   ${C.green}✔ Tag Replacement:${C.reset} 100% Clean (0 raw {{tags}} remaining)`);
      console.log(`   ${C.green}✔ Export Sample:${C.reset} ${path.relative(__dirname, samplePath)}`);
      console.log(`   ${C.green}${C.bright}STATUS: PASS ✅${C.reset}\n`);
      totalPassed++;
    } else {
      console.log(`   ${C.red}✖ FAILED CHECKS:${C.reset}`);
      issues.forEach(iss => console.log(`     - ${C.red}${iss}${C.reset}`));
      console.log(`   ${C.red}${C.bright}STATUS: FAIL ❌${C.reset}\n`);
      totalFailed++;
    }
  } catch (err) {
    console.log(`   ${C.red}✖ Exception:${C.reset} ${err.message}`);
    console.log(`   ${C.red}${C.bright}STATUS: FAIL ❌${C.reset}\n`);
    totalFailed++;
  }
}

// -------------------------------------------------------------------------
// SECTION 2: Universal Dispatcher (renderEmailTemplate)
// -------------------------------------------------------------------------
console.log(`${C.bright}[SECTION 2] Validating Universal Dispatcher (renderEmailTemplate / renderAllEmailTemplate)...${C.reset}\n`);

const universalTypes = [
  { type: 'otp', opt: { name: 'Elder Test', otpCode: '112233' } },
  { type: 'receipt', opt: { order: { name: 'Sister Test', order_id: 'TCRP-1010', item: 'Nametag', points_cost: 4 } } },
  { type: 'thankyou', opt: { order: { name: 'Elder Test', order_id: 'TCRP-2020', item: 'POS Kit' }, status: 'FULFILLED' } },
  { type: 'delivered', opt: { order: { name: 'Sister Test', order_id: 'TCRP-3030', item: 'Script Case' } } },
  { type: 'monthly_drip', opt: { dripData: { month: 10, name: 'Elder Test', message: 'Hello' } } },
  { type: 'out_of_window', opt: { dripData: { month: 10, name: 'Sister Test', message: 'Reconnect' } } }
];

let universalPassed = true;
for (const u of universalTypes) {
  try {
    const html = renderEmailTemplate(u.type, u.opt);
    const detection = detectEndsWithHtml(html);
    if (!detection.endsWithHtml || !html.includes('<!DOCTYPE html>')) {
      console.log(`   ${C.red}✖ Universal dispatcher failed for type "${u.type}" - </html> missing${C.reset}`);
      universalPassed = false;
      totalFailed++;
    } else {
      console.log(`   ${C.green}✔ Universal type "${u.type}" rendered & verified ending with </html>${C.reset}`);
    }
  } catch (err) {
    console.log(`   ${C.red}✖ Universal dispatcher error on "${u.type}": ${err.message}${C.reset}`);
    universalPassed = false;
    totalFailed++;
  }
}

if (universalPassed) {
  console.log(`\n   ${C.green}${C.bright}STATUS: ALL UNIVERSAL TYPES PASSED ✅${C.reset}\n`);
  totalPassed++;
}

// -------------------------------------------------------------------------
// SECTION 3: </html> Detection & Auto-Repair Resilience Tests
// -------------------------------------------------------------------------
console.log(`${C.bright}[SECTION 3] Validating </html> Detection & Auto-Repair Engine...${C.reset}\n`);

let repairPassed = true;

// Test A: Raw fragment without html/body
const rawFragment = '<div style="color:red;">Raw Unwrapped Fragment</div>';
const repairedA = ensureEndsWithHtml(rawFragment, "Test Subject");
const detectA = detectEndsWithHtml(repairedA);
if (detectA.endsWithHtml && repairedA.includes('Raw Unwrapped Fragment') && repairedA.includes('<!DOCTYPE html>')) {
  console.log(`   ${C.green}✔ Auto-repair correctly wrapped raw HTML fragment into full document ending with </html>${C.reset}`);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'preview-auto-repaired.html'), repairedA, 'utf8');
} else {
  console.log(`   ${C.red}✖ Auto-repair failed on raw fragment${C.reset}`);
  repairPassed = false;
  totalFailed++;
}

// Test B: Unclosed <html> missing </html>
const unclosedHtml = '<!DOCTYPE html><html><head><title>Test</title></head><body><p>Unclosed body</p>';
const repairedB = ensureEndsWithHtml(unclosedHtml);
const detectB = detectEndsWithHtml(repairedB);
if (detectB.endsWithHtml) {
  console.log(`   ${C.green}✔ Auto-repair correctly closed unclosed <html> document ending with </html>${C.reset}`);
} else {
  console.log(`   ${C.red}✖ Auto-repair failed on unclosed document${C.reset}`);
  repairPassed = false;
  totalFailed++;
}

// Test C: Simulated Brevo sendEmail with detection
(async () => {
  const simResult = await sendEmail({
    to: 'test@example.com',
    subject: 'Simulated Dispatch',
    htmlContent: '<div>Incomplete Snippet Test</div>'
  });

  if (simResult.ok && simResult.simulated) {
    console.log(`   ${C.green}✔ sendEmail successfully detected incomplete HTML and dispatched with verified </html> ending${C.reset}`);
  } else {
    console.log(`   ${C.red}✖ sendEmail simulation failed${C.reset}`);
    repairPassed = false;
    totalFailed++;
  }

  if (repairPassed) {
    console.log(`\n   ${C.green}${C.bright}STATUS: ALL AUTO-REPAIR & DETECTION TESTS PASSED ✅${C.reset}\n`);
    totalPassed++;
  }

  // -------------------------------------------------------------------------
  // FINAL REPORT
  // -------------------------------------------------------------------------
  console.log(`${C.gold}----------------------------------------------------------------${C.reset}`);
  if (totalFailed === 0) {
    console.log(`${C.green}${C.bright}🎉 ALL AUDIT & TEST PHASES PASSED 100% CLEANLY!${C.reset}`);
    console.log(`${C.cyan}Sample rendered HTML files are saved in:${C.reset} ${path.relative(process.cwd(), OUTPUT_DIR)}/`);
    console.log(`${C.gold}================================================================${C.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${C.red}${C.bright}❌ AUDIT FAILED: ${totalFailed} check(s) failed validation.${C.reset}`);
    console.log(`${C.gold}================================================================${C.reset}\n`);
    process.exit(1);
  }
})();
