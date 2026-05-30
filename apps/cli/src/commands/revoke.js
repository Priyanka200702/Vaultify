const inquirer = require('inquirer');
const apiClient = require('../services/api');
const logger = require('../utils/logger');

async function revokeToken(tokenId) {
  try {
    apiClient.requireAuth();
    if (!tokenId) {
      logger.error('Usage: vaultify tokens revoke <token-id>');
      process.exit(1);
    }

    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to revoke token ${tokenId}?`,
        default: false,
      },
    ]);

    if (!answers.confirm) {
      logger.info('Revocation cancelled');
      return;
    }

    await apiClient.delete(`/api/tokens/${tokenId}`);
    logger.success('Token revoked successfully');
  } catch (err) {
    if (err.response?.status === 401) {
      logger.error('Not authenticated. Run: vaultify login');
    } else {
      logger.error(`Failed to revoke token: ${err.message}`);
    }
    process.exit(1);
  }
}

module.exports = revokeToken;
