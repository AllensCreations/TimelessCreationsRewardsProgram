import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const targetWwwDirs = [
  path.join(rootDir, 'android', 'android-tcrp', 'app', 'src', 'main', 'assets', 'www'),
  path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'www')
];
const publicDir = path.join(rootDir, 'public');

function copyRecursive(src, dest, excludeFilter = () => false) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (excludeFilter(entry.name, srcPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath, excludeFilter);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const isExcluded = (name) => {
  const lower = name.toLowerCase();
  return lower.endsWith('.apk') ||
         lower.endsWith('.idsig') ||
         lower.endsWith('.tmp') ||
         lower === '.ds_store';
};

console.log('[sync-assets] Syncing views and assets...');

// 1. Sync views to public/
copyRecursive(path.join(rootDir, 'views'), publicDir, isExcluded);

// 2. Sync assets to public/assets/
copyRecursive(path.join(rootDir, 'assets'), path.join(publicDir, 'assets'), isExcluded);

// 3. Sync to both Android targets
for (const wwwDir of targetWwwDirs) {
  copyRecursive(path.join(rootDir, 'views'), wwwDir, isExcluded);
  copyRecursive(path.join(rootDir, 'assets'), path.join(wwwDir, 'assets'), isExcluded);
    if (fs.existsSync(path.join(publicDir, 'drips'))) { copyRecursive(path.join(publicDir, 'drips'), path.join(wwwDir, 'drips'), isExcluded); }

  // Remove any stale TimelessRewards.apk if accidentally present
  const strayApk = path.join(wwwDir, 'TimelessRewards.apk');
  if (fs.existsSync(strayApk)) {
    fs.unlinkSync(strayApk);
    console.log(`[sync-assets] Removed stray nested APK at ${strayApk}`);
  }
}

// 4. Ensure package.json is the single source of truth for version and synced everywhere
const pkgPath = path.join(rootDir, 'package.json');
if (fs.existsSync(pkgPath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const currentVersion = pkg.version || '2.49.0';
    const currentCode = Number(pkg.versionCode || pkg.version_code) || 62;
    const cleanVer = currentVersion.replace(/^v/i, '');

    // Sync views/version.json
    const rootVersion = path.join(rootDir, 'views', 'version.json');
    let versionData = {};
    if (fs.existsSync(rootVersion)) {
      try { versionData = JSON.parse(fs.readFileSync(rootVersion, 'utf8')); } catch (_) {}
    }
    versionData.version = cleanVer;
    versionData.version_code = currentCode;
    versionData.deployment_id = `deploy_${cleanVer.replace(/\./g, '_')}`;
    versionData.github_apk_url = `https://github.com/AllensCreations/TimelessCreationsRewardsProgram/raw/main/public/TimelessRewards.apk`;
    fs.writeFileSync(rootVersion, JSON.stringify(versionData, null, 2) + '\n', 'utf8');

    // Sync to public/version.json
    fs.writeFileSync(path.join(publicDir, 'version.json'), JSON.stringify(versionData, null, 2) + '\n', 'utf8');

    // Sync to Android build.gradle
    const gradleFiles = [
      path.join(rootDir, 'android', 'android-tcrp', 'app', 'build.gradle'),
      path.join(rootDir, 'android', 'app', 'build.gradle')
    ];
    for (const gf of gradleFiles) {
      if (fs.existsSync(gf)) {
        let gContent = fs.readFileSync(gf, 'utf8');
        gContent = gContent.replace(/versionCode\s+\d+/, `versionCode ${currentCode}`);
        gContent = gContent.replace(/versionName\s+["'][^"']+["']/, `versionName "${cleanVer}"`);
        fs.writeFileSync(gf, gContent, 'utf8');
      }
    }

    // Sync to Android www directories
    for (const wwwDir of targetWwwDirs) {
      if (fs.existsSync(wwwDir)) {
        fs.writeFileSync(path.join(wwwDir, 'version.json'), JSON.stringify(versionData, null, 2) + '\n', 'utf8');
      }
    }

    // Sync settings.html version badge hardcoded for offline reliability
    const settingsFiles = [
      path.join(rootDir, 'views', 'settings.html'),
      path.join(publicDir, 'settings.html'),
      ...targetWwwDirs.map(d => path.join(d, 'settings.html'))
    ];
    const badgeRegex = /(<span[^>]*id=["']app-version-badge["'][^>]*>)(.*?)(<\/span>)/i;
    for (const sf of settingsFiles) {
      if (fs.existsSync(sf)) {
        let sContent = fs.readFileSync(sf, 'utf8');
        sContent = sContent.replace(badgeRegex, `$1v${cleanVer} (Build ${currentCode})$3`);
        fs.writeFileSync(sf, sContent, 'utf8');
      }
    }

    console.log(`[sync-assets] Unified version from package.json: v${cleanVer} (Build ${currentCode})`);
  } catch (err) {
    console.error('[sync-assets] Error syncing version from package.json:', err);
  }
}

console.log('[sync-assets] Successfully synced web assets into Android www directories.');
