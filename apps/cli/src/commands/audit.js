const apiClient = require('../services/api');
const logger = require('../utils/logger');

async function showAudit(limit = 20) {
  try {
    apiClient.requireAuth();
    const response = await apiClient.get(`/api/audit?limit=${limit}`);
    const logs = response.data.logs || response.data;

    if (!logs || logs.length === 0) {
      logger.info('No audit log entries found');
      return;
    }

    const tableData = logs.map((entry) => ({
      Time: new Date(entry.timestamp).toLocaleString(),
      Token: (entry.tokenId || 'N/A').substring(0, 8),
      Endpoint: entry.endpoint || 'N/A',
      Status: entry.statusCode || 'N/A',
      Latency: `${entry.latencyMs || 0}ms`,
      Environment: entry.environment || 'N/A',
      IP: entry.sourceIp || 'N/A',
    }));

    logger.table(tableData);
  } catch (err) {
    if (err.response?.status === 401) {
      logger.error('Not authenticated. Run: vaultify login');
    } else {
      logger.error(`Failed to fetch audit logs: ${err.message}`);
    }
    process.exit(1);
  }
}

module.exports = showAudit;
