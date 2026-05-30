#!/usr/bin/env node

/**
 * Vaultify Release Script
 *
 * Runs tests, checks git status, bumps versions, and prints
 * publish commands. Does NOT auto-publish without your consent.
 *
 * Usage:
 *   node scripts/release.js [patch|minor|major]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ─────────────────────────── Config ───────────────────────────

const PACKAGES = [
  { name: 'vaultify', dir: 'packages/vaultify' },
  { name: '@vaultify/cli', dir: 'apps/cli' },
];

const BUMP = process.argv[2] || 'patch';
if (!['patch', 'minor', 'major'].includes(BUMP)) {
  console.error(`❌ Invalid bump type: "${BUMP}". Use: patch, minor, or major`);
  process.exit(1);
}

// ─────────────────────────── Helpers ───────────────────────────

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe', ...opts }).trim();
  } catch (err) {
    if (opts.ignoreError) return '';
    console.error(`❌ Command failed: ${cmd}`);
    console.error(err.stderr || err.message);
    process.exit(1);
  }
}

function readPkg(dir) {
  const pkgPath = path.join(dir, 'package.json');
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
}

function writePkg(dir, pkg) {
  const pkgPath = path.join(dir, 'package.json');
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

function bumpVersion(version, type) {
  const parts = version.split('.').map(Number);
  if (type === 'major') return `${parts[0] + 1}.0.0`;
  if (type === 'minor') return `${parts[0]}.${parts[1] + 1}.0`;
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

// ─────────────────────────── Steps ───────────────────────────

console.log('');
console.log('🚀 Vaultify Release Script');
console.log('══════════════════════════');
console.log('');

// Step 1: Check for uncommitted changes
console.log('📋 Step 1: Checking git status...');
const gitStatus = run('git status --porcelain', { ignoreError: true });
if (gitStatus) {
  console.error('❌ Uncommitted changes detected:');
  console.error(gitStatus);
  console.error('');
  console.error('Commit or stash your changes before releasing.');
  process.exit(1);
}
console.log('   ✅ Working tree is clean');
console.log('');

// Step 2: Run tests
console.log('🧪 Step 2: Running SDK tests...');
try {
  const testOutput = run(
    'node --test packages/vaultify/__tests__/client.test.js packages/vaultify/__tests__/stream.test.js',
    { cwd: process.cwd() }
  );
  console.log('   ✅ All tests passed');
} catch {
  console.error('❌ Tests failed. Fix failing tests before releasing.');
  process.exit(1);
}
console.log('');

// Step 3: Bump versions
console.log(`📦 Step 3: Bumping versions (${BUMP})...`);
const versions = {};
for (const pkg of PACKAGES) {
  const pkgJson = readPkg(pkg.dir);
  const oldVersion = pkgJson.version;
  const newVersion = bumpVersion(oldVersion, BUMP);
  pkgJson.version = newVersion;
  writePkg(pkg.dir, pkgJson);
  versions[pkg.name] = { old: oldVersion, new: newVersion };
  console.log(`   ${pkg.name}: ${oldVersion} → ${newVersion}`);
}
console.log('');

// Step 4: Print publish commands
console.log('═══════════════════════════════════════════');
console.log('');
console.log('📋 Ready to publish! Run these commands:');
console.log('');
for (const pkg of PACKAGES) {
  const v = versions[pkg.name];
  console.log(`   # ${pkg.name} (${v.old} → ${v.new})`);
  console.log(`   cd ${pkg.dir} && npm publish --access public && cd ${path.relative(pkg.dir, '.') || '.'}`);
  console.log('');
}

console.log('═══════════════════════════════════════════');
console.log('');
console.log('📝 Don\'t forget to:');
console.log('   1. git add -A && git commit -m "release: v' + versions['vaultify'].new + '"');
console.log('   2. git tag v' + versions['vaultify'].new);
console.log('   3. git push origin main --tags');
console.log('');
