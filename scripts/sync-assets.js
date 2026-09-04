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

  // Remove any stale TimelessRewards.apk if accidentally present
  const strayApk = path.join(wwwDir, 'TimelessRewards.apk');
  if (fs.existsSync(strayApk)) {
    fs.unlinkSync(strayApk);
    console.log(`[sync-assets] Removed stray nested APK at ${strayApk}`);
  }
}

// 4. Ensure version.json is synced everywhere
const rootVersion = path.join(rootDir, 'views', 'version.json');
if (fs.existsSync(rootVersion)) {
  fs.copyFileSync(rootVersion, path.join(publicDir, 'version.json'));
  for (const wwwDir of targetWwwDirs) {
    if (fs.existsSync(wwwDir)) {
      fs.copyFileSync(rootVersion, path.join(wwwDir, 'version.json'));
    }
  }
}

console.log('[sync-assets] Successfully synced web assets into Android www directories.');
