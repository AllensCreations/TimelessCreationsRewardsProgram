#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const suites = [
  { name: '500-Point Architecture & Bug Auditor', file: 'tests/test-master.js' },
  { name: 'Messenger Bot 3-in-1 Onboarding', file: 'tests/test-messenger-bot.js' },
  { name: 'Messenger Bot Check Hub & Carousel Flow', file: 'tests/test-bot-check-hub.js' },
  { name: 'Bot Anti-Spam, Quotas & OTP Protection', file: 'tests/botAntiSpamAndQuotas.test.js' },
  { name: 'Consolidated Real-World Flows (New, Invited, Existing)', file: 'tests/tester.consolidated.js', args: ['all'] },
  { name: 'Backend Suggestions & Cohort Timing', file: 'tests/backendSuggestionsAndCohort.test.js' },
  { name: 'Webhook Ingress & Telemetry Logger', file: 'tests/test-webhook-logger.js' },
  { name: 'HTML & UI Integrity Verification', file: 'tests/test-html.js' },
  { name: 'Email Templates & </html> Detection', file: 'tests/test-templates.js' },
  { name: 'Drip Rewards Dynamic Auto-Calculation', file: 'tests/test-drip-rewards-autocalc.js' }
];

async function runSuite(suite) {
  return new Promise((resolve) => {
    console.log(`\n==================================================`);
    console.log(`🚀 RUNNING: ${suite.name} (${suite.file})`);
    console.log(`==================================================`);

    const args = [path.resolve(ROOT_DIR, suite.file), ...(suite.args || [])];
    const proc = spawn('node', args, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      env: process.env
    });

    proc.on('close', (code) => {
      resolve({ name: suite.name, code, passed: code === 0 });
    });
  });
}

async function runAll() {
  console.log("🧪 ==================================================");
  console.log("🧪 TIMELESS CREATIONS REWARDS PROGRAM - ALL SUITES RUNNER");
  console.log("🧪 ==================================================");

  const results = [];
  for (const suite of suites) {
    const res = await runSuite(suite);
    results.push(res);
  }

  console.log("\n==================================================");
  console.log("📊 FINAL CONSOLIDATED TEST SUMMARY");
  console.log("==================================================");

  let allPassed = true;
  for (const r of results) {
    const icon = r.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`  ${icon} | ${r.name}`);
    if (!r.passed) allPassed = false;
  }

  console.log("==================================================");
  if (allPassed) {
    console.log("🎉 ALL TEST SUITES PASSED PERFECTLY!\n");
    process.exit(0);
  } else {
    console.error("💥 SOME TEST SUITES FAILED. Please review logs above.\n");
    process.exit(1);
  }
}

runAll();
