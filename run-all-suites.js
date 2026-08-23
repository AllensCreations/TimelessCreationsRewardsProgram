import { execSync } from 'child_process';
import fs from 'fs';

console.log("\n=======================================================");
console.log("🛡️ RUNNING ZERO-TOLERANCE 100% TCRP VERIFICATION GUARD");
console.log("=======================================================\n");

const suites = [
  { name: "Comprehensive Unit Suite", cmd: "node test-all.js" },
  { name: "Messenger Conversation Replies", cmd: "node test-all-replies.js" },
  { name: "End-to-End Infrastructure Connections", cmd: "node test-connections.js" },
  { name: "HTML & Viewport DOM Suite", cmd: "node test-html.js" }
];

let allPassed = true;

for (const suite of suites) {
  console.log(`▶ Running: ${suite.name} (${suite.cmd})...`);
  try {
    const output = execSync(suite.cmd, { stdio: 'pipe' }).toString();
    console.log(output.trim());
    console.log(`✅ [100% PASS] ${suite.name}\n`);
  } catch (err) {
    allPassed = false;
    console.error(`❌ [FAILED] ${suite.name}`);
    if (err.stdout) console.error(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    console.error("\n🚫 ABORTING COMMIT: One or more test suites did not reach 100% pass rate.\n");
    process.exit(1);
  }
}

if (allPassed) {
  console.log("🎉 ALL 4 TEST SUITES PASSED AT 100%!");
  
  let readme = fs.readFileSync("README.md", "utf8");
  const newEntry = `
### [2026-08-23] - 100% Verified Quality Guard & HTML DOM Alignment
- Aligned calendar heatmap and Brevo telemetry container identifiers across views/ and public/.
- All 4 test suites verified at 100% pass score before git commit.
`;
  if (!readme.includes("100% Verified Quality Guard")) {
    readme = readme.replace(/(## 📝 Changelog[\s\S]*)/, "$1" + newEntry);
    fs.writeFileSync("README.md", readme);
  }

  execSync("git add views/ public/ test-html.js README.md", { stdio: 'inherit' });
  execSync('git commit -m "fix(views): align DOM selectors for 100% test pass and append verified changelog"', { stdio: 'inherit' });
  execSync("git push origin main", { stdio: 'inherit' });
  console.log("\n🚀 Changes successfully committed and pushed to main branch!");
}
