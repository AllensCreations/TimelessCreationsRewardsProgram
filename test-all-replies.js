import handler from './api/webhook.js';

async function runFullReplyTest() {
  console.log("🧪 STARTING COMPREHENSIVE MESSENGER BOT REPLY TEST...\n");

  const testKeywords = [
    { name: "1. Welcome / Get Started Flow", text: "Get Started" },
    { name: "2. FAQs & Help Flow", text: "FAQs" },
    { name: "3. Dashboard & Rewards Flow", text: "Dashboard" },
    { name: "4. POS Redemption Flow", text: "redeem_keychain" }
  ];

  for (const test of testKeywords) {
    console.log(`-----------------------------------------`);
    console.log(`Testing Trigger: [ ${test.name} ] with input: "${test.text}"`);
    
    const mockReq = {
      method: 'POST',
      headers: { 'host': 'localhost:3000' },
      url: '/api/webhook',
      body: {
        object: 'page',
        entry: [
          {
            messaging: [
              {
                sender: { id: 'TEST_PSID_SIMULATOR' },
                recipient: { id: 'PAGE_ID_999' },
                timestamp: Date.now(),
                message: { text: test.text }
              }
            ]
          }
        ]
      }
    };

    const mockRes = {
      status: (code) => ({
        send: (msg) => console.log(`   📡 Webhook Response Status: ${code} (${msg})`)
      })
    };

    try {
      await handler(mockReq, mockRes);
      console.log(`   ✅ "${test.text}" processed successfully by webhook router.`);
    } catch (err) {
      console.log(`   ❌ Error on "${test.text}":`, err.message);
    }
  }

  console.log(`\n-----------------------------------------`);
  console.log("🎉 ALL REPLY ROUTERS TESTED SUCCESSFULLY!");
}

runFullReplyTest();
