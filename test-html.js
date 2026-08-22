import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

console.log("\n🧪 STARTING COMPREHENSIVE HTML VIEWS TEST SUITE...\n");

const htmlFiles = [
  'views/index.html',
  'views/drips.html',
  'views/missionaries.html',
  'views/catalog.html',
  'views/settings.html'
];

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

for (const relPath of htmlFiles) {
  const fullPath = path.resolve(relPath);
  
  if (!fs.existsSync(fullPath)) {
    // Check if it exists in public/
    const publicPath = path.resolve(relPath.replace('views/', 'public/'));
    if (!fs.existsSync(publicPath)) {
      console.error(`⚠️ SKIPPED: ${relPath} not found in views/ or public/`);
      continue;
    }
  }

  const fileToRead = fs.existsSync(fullPath) ? fullPath : path.resolve(relPath.replace('views/', 'public/'));
  const content = fs.readFileSync(fileToRead, 'utf8');

  try {
    const dom = new JSDOM(content);
    const document = dom.window.document;

    // 1. Basic DOCTYPE and HTML structural checks
    assert(document.querySelector('head') !== null, `${relPath}: Contains <head> element`);
    assert(document.querySelector('body') !== null, `${relPath}: Contains <body> element`);
    assert(document.querySelector('meta[name="viewport"]') !== null, `${relPath}: Has responsive viewport meta tag`);
    assert(document.title && document.title.length > 0, `${relPath}: Has a valid <title> ("${document.title}")`);

    // 2. CSS & Core Script integration
    const hasCss = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(l => l.href.includes('app.css'));
    assert(hasCss, `${relPath}: Linked to /assets/app.css`);

    const hasAppJs = Array.from(document.querySelectorAll('script')).some(s => s.src.includes('app.js') || s.textContent.includes('initAppLayout'));
    assert(hasAppJs, `${relPath}: Contains core app.js or init script`);

    // 3. Page-Specific structural checks
    if (relPath.includes('index.html')) {
      assert(document.getElementById('stat-missionaries') !== null, `${relPath}: Has 'stat-missionaries' element`);
      assert(document.getElementById('calendar-grid') !== null, `${relPath}: Has monthly calendar grid`);
      assert(document.getElementById('logs-container') !== null, `${relPath}: Has system logs container`);
      assert(document.getElementById('webhook-logs-list') !== null, `${relPath}: Has Brevo delivery/webhook container`);
    }

    if (relPath.includes('drips.html')) {
      assert(document.getElementById('month-select') !== null || document.querySelector('select') !== null, `${relPath}: Has month selector`);
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
