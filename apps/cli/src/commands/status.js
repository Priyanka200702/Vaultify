const apiClient = require('../services/api');
const logger = require('../utils/logger');

async function status() {
  try {
    apiClient.requireAuth();

    const spin = logger.spinner('Checking vault connection...').start();

    const [healthRes, tokensRes, keysRes] = await Promise.allSettled([
      apiClient.get('/health'),
      apiClient.get('/api/tokens'),
      apiClient.get('/api/vault/keys'),
    ]);

    if (healthRes.status === 'rejected') {
      spin.fail('Cannot connect to vault server');
      logger.info('Check your server URL in ~/.vaultify/config.json');
      process.exit(1);
    }

    spin.succeed('Vault connection: OK');

    const tokens = tokensRes.status === 'fulfilled' 
      ? (tokensRes.value.data.tokens || tokensRes.value.data) 
      : [];
    const activeTokens = tokens.filter((t) => !t.revokedAt);

    logger.info(`Active proxy tokens: ${activeTokens.length}`);

    const keys = keysRes.status === 'fulfilled'
      ? (keysRes.value.data.keys || keysRes.value.data)
      : [];
    logger.info(`Vault key slots: ${keys.length}`);

    if (activeTokens.length === 0) {
      logger.warn('No active tokens - run: vaultify tokens create');
    }

    console.log('');
    logger.success('All systems operational');
  } catch (err) {
    if (err.response?.status === 401) {
      logger.error('Not authenticated. Run: vaultify login');
    } else {
      logger.error(`Status check failed: ${err.message}`);
    }
    process.exit(1);
  }
}

module.exports = status;
