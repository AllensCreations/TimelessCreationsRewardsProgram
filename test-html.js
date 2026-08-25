import fs from 'fs';
import path from 'path';
import { JSDOM, VirtualConsole } from 'jsdom';

console.log("🔍 Running Automated HTML & UI Integrity Verification...\n");

const viewsDir = path.resolve('views');
const files = fs.existsSync(viewsDir) 
  ? fs.readdirSync(viewsDir).filter(f => f.endsWith('.html'))
  : [];

let passed = 0;
let failed = 0;

// Standalone or plain-text policy documents that do not require full app CSS/JS layout
const PLAIN_TEXT_EXEMPTIONS = ['privacy.html', 'terms.html', 'about.html', 'sw.js'];

// Virtual console to suppress noisy JSDOM CSS parse notices
const virtualConsole = new VirtualConsole();
virtualConsole.on("error", (err) => {
  if (err.message && err.message.includes("Could not parse CSS stylesheet")) return;
  console.error("  ⚠️ DOM Warning:", err.message);
});

files.forEach(file => {
  const filePath = path.join(viewsDir, file);
  const content = fs.readFileSync(filePath, 'utf8');

  try {
    const dom = new JSDOM(content, { virtualConsole });
    const doc = dom.window.document;

    // Check basic valid HTML structure
    if (!doc.head || !doc.body) {
      throw new Error("Missing required <head> or <body> tags.");
    }

    if (PLAIN_TEXT_EXEMPTIONS.includes(file)) {
      console.log(`  ✅ [PASS] ${file} (Plain document / policy file validated)`);
      passed++;
      return;
    }

    // Check for deprecated legacy routes
    const anchors = Array.from(doc.querySelectorAll('a[href]'));
    const brokenRoutes = anchors
      .map(a => a.getAttribute('href'))
      .filter(h => h === '/highlight.html' || h === '/rewards.html');

    if (brokenRoutes.length > 0) {
      throw new Error(`Contains deprecated navigation link: ${brokenRoutes.join(', ')}`);
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
