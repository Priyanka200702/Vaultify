const axios = require('axios');
const { env } = require('../config/env');

function getClient() {
  const headers = { 'x-workspace-id': '' };
  if (env.INTERNAL_API_KEY) {
    headers['x-internal-api-key'] = env.INTERNAL_API_KEY;
  }
  return axios.create({
    baseURL: env.AUDIT_SERVICE_URL || `http://localhost:${env.AUDIT_PORT || 3003}`,
    timeout: 10000,
    headers,
  });
}

async function queryLogs(workspaceId, filters = {}) {
  const { data } = await getClient().get('/api/audit', {
    params: { workspaceId, ...filters },
  });
  return data;
}

async function getStats(workspaceId) {
  const { data } = await getClient().get('/api/audit/stats', {
    params: { workspaceId },
  });
  return data;
}

async function verifyChain(workspaceId) {
  const { data } = await getClient().get('/api/audit/verify', {
    params: { workspaceId },
  });
  return data;
}

async function exportLogs(workspaceId, query = {}) {
  const { data } = await getClient().get('/api/audit/export', {
    params: { workspaceId, ...query },
    responseType: query.format === 'csv' ? 'text' : 'json',
  });
  return data;
}

module.exports = { queryLogs, getStats, verifyChain, exportLogs };
