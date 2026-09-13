import fs from 'fs';
import path from 'path';

console.log("📐 Running Multi-Viewport Responsive & Anti-Slop Integrity Audit...\n");

const indexPath = path.resolve('views/index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8');

const bentoReactPath = path.resolve('components/ui/bento-dashboard.tsx');
const bentoReactCode = fs.readFileSync(bentoReactPath, 'utf8');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

// 1. Audit Clamps & Fluid Typography in Dashboard View
console.log("--- 1. Fluid Typography & Clamp Validation (views/index.html) ---");
assert(indexHtml.includes('font-size:clamp('), 'HTML uses fluid clamp() typography for responsive text');
assert(indexHtml.includes('gap: clamp('), 'HTML uses fluid clamp() for spacing and grid gaps');
assert(indexHtml.includes('padding: clamp('), 'HTML uses fluid clamp() for card and body padding');
assert(indexHtml.includes('width: clamp('), 'SVG containers use fluid clamp() widths to prevent mobile clipping');

// 2. Audit Mobile Media Queries
console.log("\n--- 2. Responsive Breakpoint Media Queries ---");
assert(indexHtml.includes('@media(min-width: 1024px)'), 'Desktop breakpoint (min-width: 1024px) for asymmetric 2-column Bento');
assert(indexHtml.includes('@media(max-width: 520px)'), 'Mobile breakpoint (max-width: 520px) stacking radar chart & metrics');
assert(indexHtml.includes('@media(max-width: 400px)'), 'Ultra-small mobile breakpoint (max-width: 400px) for 1-column legend');

// 3. Audit Anti-Slop & Tactical Telemetry Aesthetics (Leonxlnx/taste-skill)
console.log("\n--- 3. Anti-Slop & Taste Skill Compliance ---");
assert(indexHtml.includes('[ TELEMETRY // DISPATCH_VELOCITY ]'), 'Header contains tactical monospace bracket framing');
assert(indexHtml.includes('[ VELOCITY // MON-SUN ]'), 'Bar chart card contains tactical velocity eyebrow marker');
assert(indexHtml.includes('[ SLA // HEALTH_MATRIX ]'), 'Radar chart card contains tactical SLA health matrix marker');
assert(indexHtml.includes('[ MONTHLY_LOAD // COMPOSITION ]'), 'Donut card contains tactical composition marker');
assert(indexHtml.includes('box-shadow: 0 0 0 1px rgba(0,0,0,0.8)'), 'Doppelrand double-bezel card borders applied');
assert(!indexHtml.includes('from-purple-600 to-indigo-600'), 'Free of generic AI-slop purple gradient meshes');

// 4. Audit React Component Responsive Hardening
console.log("\n--- 4. React Component Responsiveness (bento-dashboard.tsx) ---");
assert(!bentoReactCode.includes('text-3xl font-bold uppercase text-black dark:text-white'), 'Eliminated oversized text-3xl in React legend');
assert(bentoReactCode.includes('min-h-[130px] sm:min-h-[160px]'), 'Fluid responsive minimum heights in Bar chart');
assert(bentoReactCode.includes('p-4 sm:p-6'), 'Responsive card padding in React Brutalist components');
assert(bentoReactCode.includes('grid-cols-1 xs:grid-cols-2'), 'Legend grid switches to 1-column on narrow screens');

console.log(`\n======================================================`);
console.log(`✨ Responsive & Anti-Slop Audit: ${passed} Passed, ${failed} Failed`);
console.log(`======================================================\n`);

if (failed > 0) process.exit(1);
