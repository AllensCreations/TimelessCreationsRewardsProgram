import fs from 'fs';
import path from 'path';

console.log("🔍 Running Automated HTML & UI Integrity Verification...\n");

const viewsDir = path.resolve('views');
const files = fs.existsSync(viewsDir) 
  ? fs.readdirSync(viewsDir).filter(f => f.endsWith('.html'))
  : [];

let passed = 0;
let failed = 0;

// Standalone or plain-text policy documents that do not require full app CSS/JS layout
const PLAIN_TEXT_EXEMPTIONS = ['privacy.html', 'terms.html', 'about.html', 'sw.js'];

files.forEach(file => {
  const filePath = path.join(viewsDir, file);
  const content = fs.readFileSync(filePath, 'utf8');

  try {
    const hasHead = /<head[\s>]/i.test(content) && /<\/head>/i.test(content);
    const hasBody = /<body[\s>]/i.test(content) && /<\/body>/i.test(content);

    // Check basic valid HTML structure
    if (!hasHead || !hasBody) {
      throw new Error("Missing required <head> or <body> tags.");
    }

    if (PLAIN_TEXT_EXEMPTIONS.includes(file)) {
      console.log(`  ✅ [PASS] ${file} (Plain document / policy file validated)`);
      passed++;
      return;
    }

    // Check for deprecated legacy routes
    const brokenRouteMatches = content.match(/href=["']\/(highlight|rewards)\.html["']/gi);
    if (brokenRouteMatches && brokenRouteMatches.length > 0) {
      throw new Error(`Contains deprecated navigation link: ${brokenRouteMatches.join(', ')}`);
    }

    console.log(`  ✅ [PASS] ${file}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${file}: ${err.message}`);
    failed++;
  }
});

console.log(`\n================================`);
console.log(`HTML Verification: ${passed} Passed, ${failed} Failed`);
console.log(`================================\n`);

if (failed > 0) {
  process.exit(1);
}
