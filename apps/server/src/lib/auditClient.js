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

async function request(path, params, options = {}) {
  try {
    const { data } = await getClient().get(path, { params, ...options });
    return data;
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
      const error = new Error('Audit service is not available. Ensure the audit-service is running.');
      error.statusCode = 503;
      error.expose = true;
      throw error;
    }
    if (err.response) {
      const error = new Error(err.response.data?.message || 'Audit service error');
      error.statusCode = err.response.status;
      error.expose = true;
      throw error;
    }
    throw err;
  }
}

async function queryLogs(workspaceId, filters = {}) {
  return request('/api/audit', { workspaceId, ...filters });
}

async function getStats(workspaceId) {
  return request('/api/audit/stats', { workspaceId });
}

async function verifyChain(workspaceId) {
  return request('/api/audit/verify', { workspaceId });
}

async function exportLogs(workspaceId, query = {}) {
  const options = query.format === 'csv' ? { responseType: 'text' } : {};
  return request('/api/audit/export', { workspaceId, ...query }, options);
}

module.exports = { queryLogs, getStats, verifyChain, exportLogs };
