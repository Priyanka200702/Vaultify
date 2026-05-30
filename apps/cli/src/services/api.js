const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('../utils/logger');
const { getToken } = require('./keychain');

const configPath = path.join(os.homedir(), '.vaultify', 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (err) {}
  return {};
}

const config = loadConfig();

const apiClient = axios.create({
  baseURL: config.serverUrl || 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
});

async function requireAuth() {
  const token = await getToken();
  if (!token) {
    logger.error('Not logged in. Run: vaultify login');
    process.exit(1);
  }
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  const cfg = loadConfig();
  apiClient.defaults.baseURL = cfg.serverUrl || 'http://localhost:3001';
}

module.exports = apiClient;
module.exports.requireAuth = requireAuth;
