import http from 'http';

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function run() {
  console.log('🧪 Testing CDN Settings & R2 Worker URL Visibility across UI and API...\n');

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

  // 1. Check settings.html contains visible CDN card and R2 Worker URL input
  const settingsRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/settings.html',
    method: 'GET'
  });

  assert(settingsRes.status === 200, 'GET /settings.html returns 200');
  assert(!settingsRes.body.includes('id="cdn-setup-card" style="display:none;"'), 'cdn-setup-card is NOT hidden with display:none in settings.html');
  assert(settingsRes.body.includes('id="set-cdn-r2-url"'), 'set-cdn-r2-url input field exists in settings.html');
  assert(settingsRes.body.includes('Cloudflare R2 Worker URL'), 'Cloudflare R2 Worker URL label exists in settings.html');

  // 2. Check gallery.html contains modal-cdn-r2-url input
  const galleryRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/gallery.html',
    method: 'GET'
  });

  assert(galleryRes.status === 200, 'GET /gallery.html returns 200');
  assert(galleryRes.body.includes('id="modal-cdn-r2-url"'), 'modal-cdn-r2-url input field exists in gallery.html');
  assert(galleryRes.body.includes('Cloudflare R2 Worker URL'), 'Cloudflare R2 Worker URL label exists in gallery.html modal');

  // 3. Save and retrieve R2 Worker URL via API
  const testWorkerUrl = 'https://tcrp-test.workers.dev';
  const saveRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/main?action=save_cdn_config',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    cdn_r2_worker_url: testWorkerUrl
  });

  assert(saveRes.status === 200, 'POST /api/main?action=save_cdn_config returns 200');
  const saveJson = JSON.parse(saveRes.body);
  assert(saveJson.ok === true, 'Save CDN config returns ok: true');

  // Retrieve config
  const getRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/main?action=get_cdn_config',
    method: 'GET'
  });

  assert(getRes.status === 200, 'GET /api/main?action=get_cdn_config returns 200');
  const getJson = JSON.parse(getRes.body);
  assert(getJson.ok === true, 'Get CDN config returns ok: true');
  assert(getJson.config.cdn_r2_worker_url === testWorkerUrl, `Config returns saved R2 Worker URL (${getJson.config.cdn_r2_worker_url})`);

  // Clean up test value
  await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/main?action=save_cdn_config',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    cdn_r2_worker_url: ''
  });

  console.log(`\n======================================================`);
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================`);

  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Test script error:', err);
  process.exit(1);
});
