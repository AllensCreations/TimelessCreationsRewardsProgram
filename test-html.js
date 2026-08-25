import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

console.log("🔍 Running Automated HTML & UI Scaffolding Integrity Test...\n");

const viewsDir = path.resolve('views');
const files = fs.existsSync(viewsDir) 
  ? fs.readdirSync(viewsDir).filter(f => f.endsWith('.html'))
  : [];

let passed = 0;
let failed = 0;

// Pages that are plain text or standalone policy/legal pages without complex app UI
const PLAIN_TEXT_EXEMPTIONS = ['privacy.html', 'terms.html', 'about.html', 'sw.js'];

files.forEach(file => {
  const filePath = path.join(viewsDir, file);
  const content = fs.readFileSync(filePath, 'utf8');

  try {
    const dom = new JSDOM(content);
    const doc = dom.window.document;

    // Check basic valid HTML structure
    if (!doc.head || !doc.body) {
      throw new Error(`Missing basic <head> or <body> tags.`);
    }

    if (PLAIN_TEXT_EXEMPTIONS.includes(file)) {
      console.log(`  ✅ [PASS] ${file} (Plain document / policy file validated)`);
      passed++;
      return;
    }

    // Check for broken legacy routes in href attributes
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
