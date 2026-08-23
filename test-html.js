import fs from 'fs';
import path from 'path';

console.log("\n🧪 STARTING COMPREHENSIVE HTML VIEWS TEST SUITE...\n");

let passed = 0;
let failed = 0;

function assert(condition, file, testName) {
  if (condition) {
    console.log(`✅ PASS: ${file}: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${file}: ${testName}`);
    failed++;
  }
}

const DIRS_TO_TEST = ['views', 'public'];

for (const dir of DIRS_TO_TEST) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

  for (const f of files) {
    const filePath = path.join(dir, f);
    const content = fs.readFileSync(filePath, 'utf8');

    // Standard DOM checks
    assert(/<head[^>]*>/i.test(content) && /<\/head>/i.test(content), filePath, "Contains <head> element");
    assert(/<body[^>]*>/i.test(content) && /<\/body>/i.test(content), filePath, "Contains <body> element");
    assert(/<meta\s+name=["']viewport["']/i.test(content), filePath, "Has responsive viewport meta tag");
    
    const titleMatch = content.match(/<title>(.*?)<\/title>/i);
    assert(Boolean(titleMatch && titleMatch[1].trim()), filePath, `Has valid <title> ("${titleMatch ? titleMatch[1].trim() : ''}")`);

    // Standard Assets Check: Verify /assets/app.js is referenced
    if (f !== 'privacy.html') {
      const hasAppJs = /<script[^>]+src=["'][^"']*assets\/app\.js["']/i.test(content) || /initAppLayout/i.test(content);
      assert(hasAppJs, filePath, "Linked to /assets/app.js or executes layout");
    }

    assert(/initAppLayout|showToast|LocalStore|<script>/i.test(content), filePath, "Contains core app.js or init script");

    // Page-specific elements
    if (f === 'index.html') {
      assert(/stat-missionaries|loadMonthlyBatchSummary|batch-summary/i.test(content), filePath, "Has missionary stats or batch summary");
    }
    if (f === 'logs.html') {
      assert(/logs|delivery/i.test(content), filePath, "Has system logs container");
    }
  }
}

console.log("\n================================");
console.log(`HTML TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
console.log("================================\n");

if (failed > 0) process.exit(1);
