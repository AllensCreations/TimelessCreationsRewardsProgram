import { execSync } from 'child_process';

console.log("=========================================================");
console.log("🚀 STARTING TCRP 100% PRE-COMMIT VERIFICATION GATEWAY");
console.log("=========================================================\n");

const suites = [
  { name: "Core Architecture & Mailer Suite", cmd: "node test-all.js" },
  { name: "Messenger Conversation & Reply Suite", cmd: "node test-all-replies.js" },
  { name: "Live Network & Connection Ping Suite", cmd: "node test-connections.js" },
  { name: "HTML Views & DOM Integrity Suite", cmd: "node test-html.js" },
  { name: "New User Onboarding & Referral Flow Suite", cmd: "node test-new-user-flow.js" }
];

let totalPassedSuites = 0;
let failedSuites = [];

for (const suite of suites) {
  console.log(`▶ Running: ${suite.name}...`);
  try {
    execSync(suite.cmd, { stdio: 'pipe' });
    console.log(`✅ PASS: ${suite.name}\n`);
    totalPassedSuites++;
  } catch (err) {
    console.error(`❌ FAILED: ${suite.name}`);
    if (err.stdout) console.error(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    failedSuites.push(suite.name);
  }
}

console.log("=========================================================");
console.log("📊 OVERALL VERIFICATION REPORT");
console.log("=========================================================");
console.log(`Suites Passed: ${totalPassedSuites} / ${suites.length}`);
console.log(`Suites Failed: ${failedSuites.length}`);

if (failedSuites.length > 0) {
  console.error("\n❌ PRE-COMMIT GATEWAY FAILED! DO NOT COMMIT.");
  failedSuites.forEach(s => console.error(` - ${s}`));
  process.exit(1);
} else {
  console.log("\n🏆 100% PASS RATE ACHIEVED ACROSS ALL 5 SUITES! Safe to commit.");
  process.exit(0);
}
