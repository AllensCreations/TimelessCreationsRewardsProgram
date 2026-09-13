import http from 'http';
import vm from 'node:vm';

console.log("🌐 Running TCRP Comprehensive Localhost Verification on http://localhost:3000...\n");

function httpGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    http.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        body: data
      }));
    }).on('error', reject);
  });
}

async function run() {
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

  try {
    // 1. Root & HTML Delivery
    console.log("--- 1. Testing Core Localhost Web Delivery ---");
    const rootRes = await httpGet('http://localhost:3000/');
    assert(rootRes.statusCode === 200, `GET / returns HTTP 200 (Got: ${rootRes.statusCode})`);
    assert(rootRes.headers['content-type']?.includes('text/html'), `Content-Type is text/html; charset=utf-8`);
    assert(rootRes.body.includes('<!DOCTYPE html>'), `Response body contains standard DOCTYPE declaration`);
    assert(rootRes.body.includes('id="bento-analytics-card"'), `Served HTML contains Bento Analytics Card (#bento-analytics-card)`);
    assert(rootRes.body.includes('id="bento-sent-month-badge"'), `Served HTML contains Monthly Sent Badge element`);
    assert(rootRes.body.includes('id="bento-sent-today-badge"'), `Served HTML contains Today Sent Badge element`);
    assert(rootRes.body.includes('id="bento-bar-container"'), `Served HTML contains Weekly Bar Chart container`);
    assert(rootRes.body.includes('id="bento-donut-svg"'), `Served HTML contains SVG Donut chart container`);
    assert(rootRes.body.includes('id="bento-center-count"'), `Served HTML contains Donut center counter (#bento-center-count)`);

    // 2. Telemetry & Routing API Endpoints
    console.log("\n--- 2. Testing Localhost API Endpoints ---");
    const statsRes = await httpGet('http://localhost:3000/api/main?action=get_stats');
    assert(statsRes.statusCode === 200, `GET /api/main?action=get_stats returns HTTP 200`);
    const statsJson = JSON.parse(statsRes.body);
    assert(statsJson.ok === true, `Stats API payload ok: true`);
    assert(typeof statsJson.stats?.emails_month === 'number', `Stats contains emails_month number (Value: ${statsJson.stats?.emails_month})`);
    assert(typeof statsJson.stats?.emails_today === 'number', `Stats contains emails_today number (Value: ${statsJson.stats?.emails_today})`);
    assert(statsJson.stats?.power_state === 'ONLINE', `Master Power State reports ONLINE`);

    const pendingRes = await httpGet('http://localhost:3000/api/main?action=get_pending_emails');
    assert(pendingRes.statusCode === 200, `GET /api/main?action=get_pending_emails returns HTTP 200`);
    const pendingJson = JSON.parse(pendingRes.body);
    assert(pendingJson.ok === true, `Pending Queue API reports ok: true`);
    assert(Array.isArray(pendingJson.missionaries), `Pending Queue returns missionaries array`);

    // 3. Static Assets & Navigation Pages
    console.log("\n--- 3. Testing Static Assets & Sub-pages ---");
    const pages = [
      { path: '/assets/app.css', check: '--gold', desc: 'Global App Stylesheet' },
      { path: '/assets/app.js', check: 'LocalStore', desc: 'Global App Client Runtime' },
      { path: '/roster.html', check: 'Missionary Roster', desc: 'Missionary Roster View' },
      { path: '/campaigns.html', check: 'Campaigns', desc: 'Campaigns & Templates View' },
      { path: '/enrollment.html', check: 'Enrollment', desc: 'Batch Enrollment View' },
      { path: '/invoicing.html', check: 'Invoicing', desc: 'POS Invoicing View' },
      { path: '/settings.html', check: 'Settings', desc: 'Cockpit Settings View' },
      { path: '/simulator.html', check: 'Simulator', desc: 'Messenger Bot Simulator' }
    ];

    for (const p of pages) {
      const res = await httpGet(`http://localhost:3000${p.path}`);
      assert(res.statusCode === 200 && res.body.includes(p.check), `GET ${p.path} [${p.desc}] returns HTTP 200 and matches content`);
    }

    // 4. Legacy Route Redirect Verification
    console.log("\n--- 4. Testing Legacy Route 302 Redirects ---");
    const redirectRes = await httpGet('http://localhost:3000/drips.html');
    assert(redirectRes.statusCode === 302, `GET /drips.html returns HTTP 302 redirect`);
    assert(redirectRes.headers.location === '/campaigns.html', `Redirect points to /campaigns.html`);

    // 5. Client Logic Execution in V8 VM
    console.log("\n--- 5. Testing In-Browser Bento Logic & Chart Computation in V8 VM ---");
    // Extract script tag content from index.html
    const scriptMatch = rootRes.body.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/i);
    assert(!!scriptMatch, `Successfully extracted inline dashboard script block from index.html`);

    const scriptCode = scriptMatch[1];

    // Build mock DOM elements
    const elements = {};
    function createElement(id, tagName = 'div', classes = []) {
      const el = {
        id,
        tagName,
        classList: {
          _classes: new Set(classes),
          contains(c) { return this._classes.has(c); },
          add(c) { this._classes.add(c); },
          remove(c) { this._classes.delete(c); }
        },
        style: {},
        attributes: {},
        textContent: '',
        innerHTML: '',
        setAttribute(k, v) { this.attributes[k] = v; },
        getAttribute(k) { return this.attributes[k]; },
        querySelector(sel) {
          if (sel === '.year-header-btn') return elements['year-header-btn'];
          return null;
        }
      };
      elements[id] = el;
      return el;
    }

    createElement('bento-analytics-card', 'div', ['year-card', 'open']);
    createElement('bento-analytics-body', 'div');
    createElement('year-header-btn', 'button');
    createElement('bento-sent-month-badge', 'span');
    createElement('bento-sent-today-badge', 'span');
    createElement('bento-month-name-badge', 'span');
    createElement('bento-weekly-total-badge', 'span');
    createElement('bento-bar-container', 'div');
    createElement('bento-donut-svg', 'svg');
    createElement('bento-center-count', 'span');
    createElement('bento-center-sub', 'span');
    createElement('legend-count-drips', 'span');
    createElement('legend-count-reconnects', 'span');
    createElement('legend-count-receipts', 'span');
    createElement('legend-count-security', 'span');
    createElement('stat-missionaries', 'span');
    createElement('stat-sent-today', 'span');
    createElement('stat-sent-month', 'span');
    createElement('stat-due-today', 'span');
    createElement('log-ticker-container', 'div');
    createElement('cockpit-power-badge', 'span');
    createElement('cockpit-power-dot', 'span');
    createElement('cockpit-power-text', 'span');
    createElement('offline-banner', 'div');
    createElement('btn-batch-cron', 'button');
    createElement('dash-pending-queue-container', 'div');

    const sandbox = {
      console,
      setInterval: () => {},
      setTimeout: () => {},
      window: {
        addEventListener: () => {},
        removeEventListener: () => {}
      },
      addEventListener: () => {},
      removeEventListener: () => {},
      document: {
        getElementById: (id) => elements[id] || null,
        querySelectorAll: (sel) => {
          if (sel === '.donut-slice-path') {
            const matches = [...elements['bento-donut-svg'].innerHTML.matchAll(/data-key="([^"]+)"/g)];
            return matches.map(m => ({
              attributes: { 'data-key': m[1] },
              getAttribute: (k) => m[1],
              style: {}
            }));
          }
          if (sel === '.tab-bar .tab-btn') return [];
          return [];
        }
      },
      LocalStore: {
        _data: {},
        get(k, def) { return this._data[k] !== undefined ? this._data[k] : def; },
        set(k, v) { this._data[k] = v; }
      },
      TCRPSync: { fetchWithCache: () => Promise.resolve() },
      escapeHtml: s => String(s || ''),
      formatPhtShortTime: () => '12:00 PM',
      formatMonthYear: () => 'September 2026',
      initAppLayout: () => {}
    };
    sandbox.window = sandbox;

    vm.createContext(sandbox);
    vm.runInContext(scriptCode, sandbox);

    // Test live data injection
    const testPayload = {
      stats: {
        emails_month: 350,
        emails_today: 25,
        total_orders: 19,
        active_missionaries: 64
      }
    };

    sandbox.renderBentoAnalytics(testPayload);

    // Verify Month badge
    const badgeMonthText = elements['bento-sent-month-badge'].textContent;
    assert(badgeMonthText.includes('350 Sent This Month'), `Monthly badge displays '350 Sent This Month' (Got: "${badgeMonthText}")`);

    // Verify Today badge
    const badgeTodayText = elements['bento-sent-today-badge'].textContent;
    assert(badgeTodayText.includes('25 Today'), `Today badge displays '25 Today' (Got: "${badgeTodayText}")`);

    // Verify Monthly Bar Chart generated 6 monthly columns
    const barHtml = elements['bento-bar-container'].innerHTML;
    const barCount = (barHtml.match(/class="bento-bar-col"/g) || []).length;
    assert(barCount === 6, `Monthly Bar Chart generated 6 monthly columns (Got: ${barCount})`);

    // Verify Donut Chart generated SVG slice paths
    const donutHtml = elements['bento-donut-svg'].innerHTML;
    const sliceCount = (donutHtml.match(/class="donut-slice-path"/g) || []).length;
    assert(sliceCount === 4, `Donut chart rendered 4 category SVG slice paths (Got: ${sliceCount})`);

    // Verify Center Counter shows monthly count
    assert(elements['bento-center-count'].textContent === '350', `Donut center counter reflects '350' (Got: "${elements['bento-center-count'].textContent}")`);

    // Test Interactive Highlight
    sandbox.highlightDonut('drips');
    assert(elements['bento-center-sub'].textContent === 'MONTHLY DRIPS', `highlightDonut switches subtitle to 'MONTHLY DRIPS' (Got: "${elements['bento-center-sub'].textContent}")`);

    // Test Reset Donut
    sandbox.resetDonut();
    assert(elements['bento-center-count'].textContent === '350', `resetDonut restores total count 350`);
    assert(elements['bento-center-sub'].textContent === 'Sent This Month', `resetDonut restores subtitle 'Sent This Month'`);

    // Test Collapsible Toggle
    assert(elements['bento-analytics-card'].classList.contains('open'), `Card starts open`);
    sandbox.toggleBentoAnalytics();
    assert(!elements['bento-analytics-card'].classList.contains('open'), `toggleBentoAnalytics() collapses card`);
    assert(elements['bento-analytics-body'].style.display === 'none', `toggleBentoAnalytics() hides body`);
    assert(sandbox.LocalStore.get('bento_analytics_collapsed') === true, `Collapse state saved to LocalStore`);

    sandbox.toggleBentoAnalytics();
    assert(elements['bento-analytics-card'].classList.contains('open'), `toggleBentoAnalytics() re-expands card`);
    assert(elements['bento-analytics-body'].style.display === 'block', `toggleBentoAnalytics() displays body`);
    assert(sandbox.LocalStore.get('bento_analytics_collapsed') === false, `Expanded state saved to LocalStore`);

    console.log(`\n======================================================`);
    console.log(`🎉 TCRP Localhost Testing: ${passed} Passed, ${failed} Failed`);
    console.log(`======================================================\n`);

    if (failed > 0) process.exit(1);

  } catch (err) {
    console.error("Localhost test execution error:", err);
    process.exit(1);
  }
}

run();
