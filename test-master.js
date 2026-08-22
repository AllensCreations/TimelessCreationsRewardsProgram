import { execSync } from 'child_process';
import fs from 'fs';

console.log("=========================================================");
console.log("🚀 STARTING TCRP 100% PRE-COMMIT VERIFICATION GATEWAY");
console.log("=========================================================\n");

const suites = [
  { name: "Core Architecture & Mailer Suite", cmd: "node test-all.js" },
  { name: "Messenger Conversation & Reply Suite", cmd: "node test-all-replies.js" },
  { name: "Live Network & Connection Ping Suite", cmd: "node test-connections.js" },
  { name: "HTML Views & DOM Integrity Suite", cmd: "node test-html.js" }
];

let totalPassedSuites = 0;
let failedSuites = [];

for (const suite of suites) {
  console.log(`▶ Running: ${suite.name} (${suite.cmd})...`);
  try {
    const output = execSync(suite.cmd, { stdio: 'pipe' }).toString();
    console.log(`✅ PASS: ${suite.name}`);
    totalPassedSuites++;
  } catch (err) {
    console.error(`❌ FAILED: ${suite.name}`);
    if (err.stdout) console.error(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    failedSuites.push(suite.name);
  }
}

console.log("\n=========================================================");
console.log("📊 OVERALL VERIFICATION REPORT");
console.log("=========================================================");
console.log(`Suites Passed: ${totalPassedSuites} / ${suites.length}`);
console.log(`Suites Failed: ${failedSuites.length}`);

if (failedSuites.length > 0) {
  console.error("\n❌ PRE-COMMIT GATEWAY FAILED! DO NOT COMMIT.");
  console.error("The following suites did not achieve 100% pass rate:");
  failedSuites.forEach(s => console.error(` - ${s}`));
  process.exit(1);
} else {
  console.log("\n🏆 100% PASS RATE ACHIEVED! Safe to commit and deploy.");
  process.exit(0);
}
