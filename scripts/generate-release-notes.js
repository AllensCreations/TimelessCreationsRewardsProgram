import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function getArg(argName) {
  const idx = process.argv.indexOf(argName);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return null;
}

function getLatestTag() {
  try {
    return execSync('git describe --tags --abbrev=0 HEAD~1 2>/dev/null', { cwd: rootDir, encoding: 'utf8' }).trim();
  } catch (_) {
    try {
      return execSync('git describe --tags --abbrev=0 2>/dev/null', { cwd: rootDir, encoding: 'utf8' }).trim();
    } catch (_) {
      return '';
    }
  }
}

function getCommitHistory(fromTag) {
  try {
    const range = fromTag ? `${fromTag}..HEAD` : 'HEAD~15..HEAD';
    const log = execSync(`git log ${range} --pretty=format:"%s (%h)"`, { cwd: rootDir, encoding: 'utf8' }).trim();
    if (!log) return [];
    return log.split('\n').map(s => s.trim()).filter(Boolean);
  } catch (_) {
    return [];
  }
}

function isSkipNoise(msg) {
  const lower = msg.toLowerCase();
  return lower.includes('chore(release): bump version') || (lower.includes('[skip ci]') && lower.includes('bump version'));
}

function cleanCommitMessage(msg) {
  return msg
    .replace(/^(feat|fix|bug|perf|refactor|style|chore|docs|test|ci)(\([a-zA-Z0-9_\-./]+\))?:\s*/i, '')
    .trim();
}

function categorizeCommits(commits) {
  const categories = {
    features: [],
    fixes: [],
    improvements: [],
    others: []
  };

  for (const commit of commits) {
    if (isSkipNoise(commit)) continue;

    const lower = commit.toLowerCase();
    if (lower.startsWith('feat') || lower.startsWith('add') || lower.includes('feature')) {
      categories.features.push(cleanCommitMessage(commit));
    } else if (lower.startsWith('fix') || lower.startsWith('bug') || lower.includes('patch')) {
      categories.fixes.push(cleanCommitMessage(commit));
    } else if (lower.startsWith('perf') || lower.startsWith('refactor') || lower.startsWith('style') || lower.startsWith('ui')) {
      categories.improvements.push(cleanCommitMessage(commit));
    } else {
      categories.others.push(cleanCommitMessage(commit));
    }
  }

  return categories;
}

function formatChangelogForModal(markdownText) {
  return markdownText
    .replace(/^###\s+(.*$)/gim, '<div style="font-weight:600; color:var(--gold,#c9a84c); margin-top:6px; margin-bottom:2px;">$1</div>')
    .replace(/^-\s+\*\*(.*?)\*\*:\s*(.*$)/gim, '<div style="margin-left:8px; margin-bottom:3px; font-size:0.75rem;">• <strong>$1:</strong> $2</div>')
    .replace(/^-\s+(.*$)/gim, '<div style="margin-left:8px; margin-bottom:3px; font-size:0.75rem;">• $1</div>')
    .replace(/\n\n+/g, '')
    .trim();
}

export function generateReleaseNotes() {
  const versionArg = getArg('--version');
  const codeArg = getArg('--code');
  const fromTagArg = getArg('--from-tag') || getLatestTag();
  const dryRun = process.argv.includes('--dry-run');

  const gradlePath = path.join(rootDir, 'android', 'android-tcrp', 'app', 'build.gradle');
  let currentVersion = versionArg;
  let currentCode = codeArg ? Number(codeArg) : null;

  if (fs.existsSync(gradlePath)) {
    const gradleContent = fs.readFileSync(gradlePath, 'utf8');
    if (!currentVersion) {
      const vMatch = gradleContent.match(/versionName\s+["']([^"']+)["']/);
      if (vMatch) currentVersion = vMatch[1];
    }
    if (!currentCode) {
      const cMatch = gradleContent.match(/versionCode\s+(\d+)/);
      if (cMatch) currentCode = Number(cMatch[1]);
    }
  }

  currentVersion = currentVersion || '2.5.0';
  currentCode = currentCode || 17;

  console.log(`[release-notes] Generating notes for v${currentVersion} (Build ${currentCode})`);
  console.log(`[release-notes] Commit range base: ${fromTagArg || 'recent commits'}`);

  let manualNotes = '';
  const manualNotesPath = path.join(rootDir, 'RELEASE_NOTES.md');
  if (fs.existsSync(manualNotesPath)) {
    manualNotes = fs.readFileSync(manualNotesPath, 'utf8').trim();
    console.log('[release-notes] Found manual RELEASE_NOTES.md');
  }

  const commits = getCommitHistory(fromTagArg);
  const categories = categorizeCommits(commits);

  let releaseBody = `## 🎁 Timeless Rewards v${currentVersion} (Build ${currentCode})\n\n`;
  releaseBody += `- **Build Code**: \`${currentCode}\`\n`;
  releaseBody += `- **Branch**: \`Appversion\`\n`;
  releaseBody += `- **Direct APK**: [Download TimelessRewards.apk](https://github.com/AllensCreations/TimelessCreationsRewardsProgram/raw/Appversion/public/TimelessRewards.apk)\n\n`;

  let notesMarkdown = '';

  if (manualNotes) {
    notesMarkdown = manualNotes;
    releaseBody += `${manualNotes}\n\n`;
  } else {
    if (categories.features.length > 0) {
      notesMarkdown += `### 🚀 New Features\n`;
      categories.features.forEach(f => {
        notesMarkdown += `- ${f}\n`;
      });
      notesMarkdown += `\n`;
    }

    if (categories.fixes.length > 0) {
      notesMarkdown += `### 🐛 Bug Fixes\n`;
      categories.fixes.forEach(f => {
        notesMarkdown += `- ${f}\n`;
      });
      notesMarkdown += `\n`;
    }

    if (categories.improvements.length > 0) {
      notesMarkdown += `### ⚡ Enhancements & Improvements\n`;
      categories.improvements.forEach(f => {
        notesMarkdown += `- ${f}\n`;
      });
      notesMarkdown += `\n`;
    }

    if (!notesMarkdown) {
      if (categories.others.length > 0) {
        notesMarkdown += `### 🔧 Updates\n`;
        categories.others.forEach(f => {
          notesMarkdown += `- ${f}\n`;
        });
        notesMarkdown += `\n`;
      } else {
        notesMarkdown += `### 🔧 Maintenance & Stability\n- General performance improvements, security updates, and asset sync.\n\n`;
      }
    }

    releaseBody += `${notesMarkdown}\n`;
  }

  const finalInAppChangelog = formatChangelogForModal(notesMarkdown);

  const versionJsonPath = path.join(rootDir, 'views', 'version.json');
  let versionData = {};
  if (fs.existsSync(versionJsonPath)) {
    try {
      versionData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
    } catch (_) {}
  }

  const parts = currentVersion.split('.');
  const major = parts[0] || '2';
  const minor = parts[1] || '0';
  const nowIso = new Date().toISOString();
  const dateStr = nowIso.slice(0, 10).replace(/-/g, '');

  versionData.version = currentVersion;
  versionData.version_code = currentCode;
  versionData.deployment_id = `deploy_${dateStr}_v${major}_${minor}`;
  versionData.build_timestamp = nowIso;
  versionData.apk_url = 'https://timelesscreationsrewardsprogram.vercel.app/TimelessRewards.apk';
  versionData.github_apk_url = 'https://github.com/AllensCreations/TimelessCreationsRewardsProgram/raw/Appversion/public/TimelessRewards.apk';
  versionData.changelog = finalInAppChangelog;

  if (dryRun) {
    console.log('\n--- DRY RUN: RELEASE_BODY.md ---');
    console.log(releaseBody);
    console.log('\n--- DRY RUN: views/version.json ---');
    console.log(JSON.stringify(versionData, null, 2));
    return;
  }

  const releaseBodyPath = path.join(rootDir, 'RELEASE_BODY.md');
  fs.writeFileSync(releaseBodyPath, releaseBody, 'utf8');
  console.log(`[release-notes] Written: ${releaseBodyPath}`);

  fs.writeFileSync(versionJsonPath, JSON.stringify(versionData, null, 2) + '\n', 'utf8');
  console.log(`[release-notes] Updated: ${versionJsonPath}`);

  const publicVersionPath = path.join(rootDir, 'public', 'version.json');
  fs.writeFileSync(publicVersionPath, JSON.stringify(versionData, null, 2) + '\n', 'utf8');
  console.log(`[release-notes] Updated: ${publicVersionPath}`);

  const changelogPath = path.join(rootDir, 'CHANGELOG.md');
  let existingChangelog = '';
  if (fs.existsSync(changelogPath)) {
    existingChangelog = fs.readFileSync(changelogPath, 'utf8');
  } else {
    existingChangelog = '# Changelog\n\nAll notable changes to the Timeless Rewards Android APK and platform are documented here.\n\n';
  }

  const releaseHeading = `## [v${currentVersion}] - ${nowIso.slice(0, 10)} (Build ${currentCode})\n\n`;
  if (!existingChangelog.includes(`[v${currentVersion}]`)) {
    const headerEndIdx = existingChangelog.indexOf('\n\n## ');
    let newChangelog = '';
    const releaseContent = notesMarkdown.trim() + '\n';
    if (headerEndIdx !== -1) {
      newChangelog = existingChangelog.slice(0, headerEndIdx + 2) + releaseHeading + releaseContent + '\n' + existingChangelog.slice(headerEndIdx + 2);
    } else {
      newChangelog = existingChangelog + '\n' + releaseHeading + releaseContent + '\n';
    }
    fs.writeFileSync(changelogPath, newChangelog, 'utf8');
    console.log(`[release-notes] Updated: ${changelogPath}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateReleaseNotes();
}
