const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SERVICE_NAME = 'vaultify-cli';
const ACCOUNT_NAME = 'auth-token';
const FALLBACK_DIR = path.join(os.homedir(), '.vaultify');
const FALLBACK_PATH = path.join(FALLBACK_DIR, 'config.json');

function isWindows() { return process.platform === 'win32'; }
function isMacOS() { return process.platform === 'darwin'; }
function isLinux() { return process.platform === 'linux'; }

function ensureFallbackDir() {
  if (!fs.existsSync(FALLBACK_DIR)) {
    fs.mkdirSync(FALLBACK_DIR, { recursive: true });
  }
}

function windowsDpapiStore(token) {
  const script = `
    $bytes = [System.Text.Encoding]::UTF8.GetBytes('${token.replace(/'/g, "''")}')
    $encrypted = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, 'CurrentUser')
    $b64 = [Convert]::ToBase64String($encrypted)
    $b64 | Out-File -FilePath "${FALLBACK_DIR}\\token.enc" -Force
  `;
  execSync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
}

function windowsDpapiRead() {
  const encPath = path.join(FALLBACK_DIR, 'token.enc');
  if (!fs.existsSync(encPath)) return null;
  const script = `
    $b64 = Get-Content "${FALLBACK_DIR}\\token.enc" -Raw
    $encrypted = [Convert]::FromBase64String($b64.Trim())
    $decrypted = [System.Security.Cryptography.ProtectedData]::Unprotect($encrypted, $null, 'CurrentUser')
    Write-Output ([System.Text.Encoding]::UTF8.GetString($decrypted))
  `;
  return execSync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`, { stdio: 'pipe', encoding: 'utf-8' }).trim();
}

function windowsDpapiDelete() {
  const encPath = path.join(FALLBACK_DIR, 'token.enc');
  if (fs.existsSync(encPath)) fs.unlinkSync(encPath);
}

async function storeToken(token) {
  try {
    ensureFallbackDir();
    if (isWindows()) {
      windowsDpapiStore(token);
      return true;
    }
    if (isMacOS()) {
      execSync(`security add-generic-password -a "${ACCOUNT_NAME}" -s "${SERVICE_NAME}" -w "${token}" -U`, { stdio: 'pipe' });
      return true;
    }
    if (isLinux()) {
      execSync(`secret-tool store --label="Vaultify CLI Token" service "${SERVICE_NAME}" account "${ACCOUNT_NAME}"`, { input: token, stdio: ['pipe', 'pipe', 'pipe'] });
      return true;
    }
  } catch (e) {}
  return fallbackStore(token);
}

async function getToken() {
  try {
    if (isWindows()) {
      const val = windowsDpapiRead();
      if (val) return val;
    }
    if (isMacOS()) {
      const val = execSync(`security find-generic-password -a "${ACCOUNT_NAME}" -s "${SERVICE_NAME}" -w 2>/dev/null`, { encoding: 'utf-8', stdio: 'pipe' }).trim();
      if (val) return val;
    }
    if (isLinux()) {
      const val = execSync(`secret-tool lookup service "${SERVICE_NAME}" account "${ACCOUNT_NAME}" 2>/dev/null`, { encoding: 'utf-8', stdio: 'pipe' }).trim();
      if (val) return val;
    }
  } catch (e) {}
  return fallbackRead();
}

async function deleteToken() {
  try {
    if (isWindows()) {
      windowsDpapiDelete();
      return true;
    }
    if (isMacOS()) {
      execSync(`security delete-generic-password -a "${ACCOUNT_NAME}" -s "${SERVICE_NAME}" 2>/dev/null`, { stdio: 'pipe' });
      return true;
    }
    if (isLinux()) {
      execSync(`secret-tool clear service "${SERVICE_NAME}" account "${ACCOUNT_NAME}" 2>/dev/null`, { stdio: 'pipe' });
      return true;
    }
  } catch (e) {}
  return fallbackDelete();
}

function fallbackStore(token) {
  try {
    ensureFallbackDir();
    const config = fallbackRead() || {};
    config.authToken = token;
    fs.writeFileSync(FALLBACK_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
    fs.chmodSync(FALLBACK_PATH, 0o600);
    return true;
  } catch (e) { return false; }
}

function fallbackRead() {
  try {
    if (fs.existsSync(FALLBACK_PATH)) return JSON.parse(fs.readFileSync(FALLBACK_PATH, 'utf-8'));
  } catch (e) {}
  return null;
}

function fallbackDelete() {
  try {
    const config = fallbackRead();
    if (config) { delete config.authToken; fs.writeFileSync(FALLBACK_PATH, JSON.stringify(config, null, 2), { mode: 0o600 }); }
    return true;
  } catch (e) { return false; }
}

module.exports = { storeToken, getToken, deleteToken };
