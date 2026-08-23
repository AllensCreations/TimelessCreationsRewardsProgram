import fs from 'fs';
import path from 'path';
import { JSDOM, VirtualConsole } from 'jsdom';

console.log("\n🧪 STARTING COMPREHENSIVE HTML VIEWS TEST SUITE...\n");

// Suppress CSS stylesheet parsing noise from JSDOM in terminal
const virtualConsole = new VirtualConsole();
virtualConsole.on("error", () => {});
virtualConsole.on("warn", () => {});

const searchDirs = ['views', 'public'];
let foundHtmlFiles = [];

for (const dir of searchDirs) {
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
    files.forEach(f => {
      const relPath = path.join(dir, f);
      if (!foundHtmlFiles.includes(relPath)) {
        foundHtmlFiles.push(relPath);
      }
    });
  }
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  }
}

for (const relPath of foundHtmlFiles) {
  const fullPath = path.resolve(relPath);
  if (!fs.existsSync(fullPath)) continue;

  const content = fs.readFileSync(fullPath, 'utf8');

  try {
    const dom = new JSDOM(content, { virtualConsole });
    const document = dom.window.document;

    // 1. Structural tags
    assert(document.querySelector('head') !== null, `${relPath}: Contains <head> element`);
    assert(document.querySelector('body') !== null, `${relPath}: Contains <body> element`);
    assert(document.querySelector('meta[name="viewport"]') !== null, `${relPath}: Has responsive viewport meta tag`);
    assert(document.title && document.title.length > 0, `${relPath}: Has valid <title> ("${document.title}")`);

    // 2. CSS & script validation
    const isStandalone = relPath.includes('privacy.html');
    if (!isStandalone) {
      const hasCss = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(l => l.href.includes('app.js'));
      assert(hasCss, `${relPath}: Linked to /assets/app.js`);

      const hasAppJs = Array.from(document.querySelectorAll('script')).some(s => s.src.includes('app.js') || s.textContent.includes('initAppLayout'));
      assert(hasAppJs, `${relPath}: Contains core app.js or init script`);
    }

    // 3. View-specific component checks
    if (relPath.includes('index.html')) {
      assert(document.getElementById('stat-missionaries') !== null, `${relPath}: Has 'stat-missionaries' element`);
      assert(document.getElementById('calendar-grid') !== null, `${relPath}: Has monthly calendar grid`);
    }

    if (relPath.includes('logs.html')) {
      assert(document.getElementById('logs-container') !== null, `${relPath}: Has system logs container`);
      assert(document.getElementById('webhook-logs-list') !== null, `${relPath}: Has Brevo delivery/webhook container`);
    }

  } catch (err) {
    assert(false, `${relPath} parsing failed: ${err.message}`);
  }
}

console.log(`\n================================`);
console.log(`HTML TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
console.log(`================================\n`);

if (failed > 0) {
  process.exit(1);
}
