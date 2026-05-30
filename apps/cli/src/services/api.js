const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('../utils/logger');

const configPath = path.join(os.homedir(), '.vaultify', 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (err) {
    // Config not found or invalid
  }
  return {};
}

let config = loadConfig();

const apiClient = axios.create({
  baseURL: config.serverUrl || 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json',
  },
});

if (config.authToken) {
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${config.authToken}`;
}

function refreshConfig() {
  config = loadConfig();
  apiClient.defaults.baseURL = config.serverUrl || 'http://localhost:3001';
  if (config.authToken) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${config.authToken}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
}

function requireAuth() {
  const cfg = loadConfig();
  if (!cfg.authToken) {
    logger.error('Not logged in. Run: vaultify login');
    process.exit(1);
  }
  refreshConfig();
}

module.exports = apiClient;
module.exports.refreshConfig = refreshConfig;
module.exports.requireAuth = requireAuth;
