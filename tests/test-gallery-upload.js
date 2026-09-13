import http from 'http';
import fs from 'fs';
import path from 'path';

console.log("🖼️ Testing Media Gallery Upload, Disk Persistence & Anti-Default-Image Verification...\n");

function httpRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        body: data
      }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  let passed = 0;
  let failed = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log(`  ✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${msg}`);
      failed++;
    }
  }

  try {
    // 1. Check cdn_list
    console.log("--- 1. Testing Gallery List Retrieval ---");
    const listRes = await httpRequest('http://localhost:3000/api/main?action=cdn_list');
    assert(listRes.statusCode === 200, `GET /api/main?action=cdn_list returns 200`);
    const listJson = JSON.parse(listRes.body);
    assert(listJson.ok === true, `cdn_list reports ok: true`);
    assert(Array.isArray(listJson.gallery) && listJson.gallery.length > 0, `cdn_gallery returns non-empty array (Got: ${listJson.gallery?.length} items)`);
    assert(!!listJson.gallery[0].direct_url, `Items contain valid direct_url: ${listJson.gallery[0].direct_url}`);
    assert(!listJson.gallery[0].direct_url.includes('undefined'), `direct_url does not contain undefined`);

    // 2. Test Image Upload with base64 data (1x1 transparent WebP)
    console.log("\n--- 2. Testing Image Upload to Local & CDN Storage ---");
    const sampleWebpBase64 = 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAkA4JaQAA3AA/vuUAAA=';
    const testFilename = `test_upload_${Date.now()}.webp`;

    const uploadPayload = JSON.stringify({
      action: 'cdn_upload',
      filename: testFilename,
      targetSize: 'webp_2kb',
      originalKb: 4,
      compressedKb: 2,
      base64Data: sampleWebpBase64
    });

    const uploadRes = await httpRequest('http://localhost:3000/api/main', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(uploadPayload)
      }
    }, uploadPayload);

    assert(uploadRes.statusCode === 200, `POST cdn_upload returns HTTP 200 (Got: ${uploadRes.statusCode})`);
    const uploadJson = JSON.parse(uploadRes.body);
    assert(uploadJson.ok === true, `Upload response reports ok: true`);
    assert(uploadJson.direct_url === `/assets/rewards/${testFilename}` || uploadJson.direct_url.includes(testFilename), `Upload returns direct_url pointing to uploaded file (${uploadJson.direct_url})`);

    // 3. Verify Local Disk Persistence
    console.log("\n--- 3. Testing Local Disk Persistence & Static Delivery ---");
    const savedPath = path.resolve('public/assets/rewards', testFilename);
    assert(fs.existsSync(savedPath), `File was written to disk at ${savedPath}`);
    assert(fs.statSync(savedPath).size > 0, `Saved file size is > 0 bytes (${fs.statSync(savedPath).size} bytes)`);

    // 4. Verify Server Serves the Uploaded File Directly
    const staticRes = await httpRequest(`http://localhost:3000/assets/rewards/${testFilename}`);
    assert(staticRes.statusCode === 200, `GET /assets/rewards/${testFilename} returns HTTP 200`);
    assert(staticRes.headers['content-type'] === 'image/webp', `Content-Type is image/webp`);

    // 5. Verify Item is in cdn_list
    console.log("\n--- 4. Testing Gallery List Contains Newly Uploaded Item ---");
    const listRes2 = await httpRequest('http://localhost:3000/api/main?action=cdn_list');
    const listJson2 = JSON.parse(listRes2.body);
    const uploadedItem = listJson2.gallery.find(i => i.filename === testFilename);
    assert(!!uploadedItem, `Gallery list includes newly uploaded item '${testFilename}'`);
    assert(uploadedItem?.direct_url === `/assets/rewards/${testFilename}` || uploadedItem?.direct_url.includes(testFilename), `Item direct_url is correct`);

    // 6. Verify HTML does not replace with default image
    console.log("\n--- 5. Anti-Default-Image Verification in gallery.html ---");
    const galleryHtml = fs.readFileSync(path.resolve('views/gallery.html'), 'utf8');
    assert(!galleryHtml.includes("onerror=\"this.src='https://i.postimg.cc/FFdrCNqq/Untitled56-20260820115353.png'\""), `Eliminated hardcoded fallback to default reward image`);
    assert(galleryHtml.includes('handleImageError'), `Employs multi-tier handleImageError fallback`);

    // 7. Cleanup test item
    if (uploadedItem?.id) {
      const deletePayload = JSON.stringify({ action: 'cdn_delete', id: uploadedItem.id });
      await httpRequest('http://localhost:3000/api/main', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(deletePayload) }
      }, deletePayload);
      if (fs.existsSync(savedPath)) fs.unlinkSync(savedPath);
    }

    console.log(`\n======================================================`);
    console.log(`🎉 Media Gallery Upload Verification: ${passed} Passed, ${failed} Failed`);
    console.log(`======================================================\n`);

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error("Test execution error:", err);
    process.exit(1);
  }
}

run();
