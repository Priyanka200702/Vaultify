const apiClient = require('../services/api');
const logger = require('../utils/logger');

async function listTokens() {
  try {
    apiClient.requireAuth();
    const response = await apiClient.get('/api/tokens');
    const tokens = response.data.tokens || response.data;

    if (!tokens || tokens.length === 0) {
      logger.info('No active tokens found');
      return;
    }

    const tableData = tokens.map((t) => ({
      ID: (t._id || t.id || '').substring(0, 8),
      Provider: t.vaultKeyId?.provider || 'N/A',
      Environment: t.environment || 'N/A',
      'Rate Limit': t.rateLimitDaily || 'Unlimited',
      Status: t.revokedAt ? 'Revoked' : 'Active',
      Expires: t.expiresAt ? new Date(t.expiresAt).toLocaleDateString() : 'Never',
    }));

    logger.table(tableData);
  } catch (err) {
    if (err.response?.status === 401) {
      logger.error('Not authenticated. Run: vaultify login');
    } else {
      logger.error(`Failed to fetch tokens: ${err.message}`);
    }
    process.exit(1);
  }
}

module.exports = listTokens;
