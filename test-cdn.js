import 'dotenv/config';
import { runSql } from './lib/db.js';

async function testGitHubCdnConnection() {
  console.log("🔍 ==================================================");
  console.log("🔍 STARTING GITHUB CDN API DIAGNOSTIC TEST");
  console.log("🔍 ==================================================\n");

  // 1. Fetch credentials from DB or environment
  let owner = process.env.CDN_GITHUB_OWNER;
  let repo = process.env.CDN_GITHUB_REPO;
  let token = process.env.CDN_GITHUB_TOKEN;

  try {
    const configRows = await runSql("SELECT key, value FROM system_settings WHERE key LIKE 'cdn_%'");
    const dbConfig = {};
    (configRows || []).forEach(r => { dbConfig[r.key] = r.value; });

    owner = owner || dbConfig.cdn_github_owner || 'AllensCreations';
    repo = repo || dbConfig.cdn_github_repo || 'Gallery';
    token = token || dbConfig.cdn_github_token || '';
  } catch (err) {
    console.log("⚠️ Could not read CDN config from Turso DB, falling back to environment variables.");
  }

  console.log(`📂 Configuration Target:`);
  console.log(`   • Owner : ${owner || '(Missing)'}`);
  console.log(`   • Repo  : ${repo || '(Missing)'}`);
  console.log(`   • Token : ${token ? token.slice(0, 8) + '...' : '(Missing / Empty)'}\n`);

  if (!token) {
    console.error("❌ [FAIL] GitHub Personal Access Token is completely missing!");
    console.error("   Action: Go to /settings.html and paste your valid GitHub token.");
    return;
  }

  // 2. Test GitHub API Repository Read Access
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
  console.log(`🌐 Pinging GitHub API: ${apiUrl} ...`);

  try {
    const res = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'TCRP-CDN-Tester',
        'Accept': 'application/vnd.github+json'
      }
    });

    console.log(`   • HTTP Status Code: ${res.status} ${res.statusText}`);
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      console.log(`  ✅ [PASS] Successfully authenticated with GitHub API!`);
      console.log(`   • Repository Name : ${data.full_name}`);
      console.log(`   • Default Branch  : ${data.default_branch}`);
      console.log(`   • Private Repo    : ${data.private ? 'Yes' : 'No'}`);
    } else {
      console.error(`  ❌ [FAIL] GitHub API rejected the request.`);
      console.error(`   • Error Message   : ${data.message || 'Unknown error'}`);
      if (res.status === 401) {
        console.error(`   👉 Reason: Your GitHub Token is expired, revoked, or malformed.`);
      } else if (res.status === 404) {
        console.error(`   👉 Reason: Repository '${owner}/${repo}' does not exist or your token lacks permissions to see it.`);
      }
    }
  } catch (err) {
    console.error(`  ❌ [FAIL] Network connection error while reaching GitHub API: ${err.message}`);
  }

  console.log(`\n==================================================`);
  console.log(`🏁 DIAGNOSTIC COMPLETE`);
  console.log(`==================================================\n`);
}

testGitHubCdnConnection();
