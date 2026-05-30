const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const apiClient = require('../services/api');
const vercelService = require('../services/vercel');
const logger = require('../utils/logger');
const { parseVaultifyFile } = require('../services/envParser');

async function sync() {
  try {
    apiClient.requireAuth();

    const vaultifyTokens = parseVaultifyFile();
    if (vaultifyTokens.length === 0) {
      logger.error('.env.vaultify not found or contains no proxy tokens');
      logger.info('Create .env.vaultify with your proxy tokens (vlt_...) first');
      process.exit(1);
    }

    logger.success('Found .env.vaultify');

    const spin = logger.spinner('Validating tokens with vault...').start();
    const response = await apiClient.get('/api/tokens');
    spin.succeed('Tokens validated');
    const activeTokens = response.data.tokens || response.data;

    const tokenDetails = vaultifyTokens.map((vt) => {
      const match = activeTokens.find((t) =>
        (t.tokenString || t.token) === vt.token
      );
      return {
        envKey: vt.envKey,
        token: vt.token,
        provider: match?.vaultKeyId?.provider || 'N/A',
        environment: match?.environment || 'production',
        status: match?.revokedAt ? 'REVOKED' : 'ACTIVE',
      };
    });

    console.log('');
    tokenDetails.forEach((td) => {
      logger.info(`  ${td.envKey} -> ${td.token.substring(0, 15)}... (${td.provider} · ${td.environment})`);
    });

    const vercelToken = process.env.VERCEL_TOKEN;
    if (!vercelToken) {
      logger.warn('VERCEL_TOKEN not set — skipping Vercel sync');
      logger.info('Set with: export VERCEL_TOKEN=your_token');
      process.exit(0);
    }

    const vercelProjectId = process.env.VERCEL_PROJECT_ID;
    if (!vercelProjectId) {
      logger.warn('VERCEL_PROJECT_ID not set — skipping Vercel sync');
      logger.info('Set with: export VERCEL_PROJECT_ID=your_project_id');
      process.exit(0);
    }

    const { targets } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'targets',
        message: 'Target Vercel environments:',
        choices: [
          { name: 'Production', value: 'production', checked: true },
          { name: 'Preview', value: 'preview', checked: true },
          { name: 'Development', value: 'development', checked: true },
        ],
        validate: (input) => input.length > 0 || 'Select at least one environment',
      },
    ]);

    const existingVars = await vercelService.getEnvVars(vercelProjectId);

    for (const vt of vaultifyTokens) {
      try {
        const existing = existingVars.find((ev) => ev.key === vt.envKey);
        if (existing) {
          await vercelService.updateEnvVar(vercelProjectId, existing.id, vt.envKey, vt.token, targets);
          logger.success(`Updated Vercel → ${vt.envKey} (${targets.join(', ')})`);
        } else {
          await vercelService.setEnvVar(vercelProjectId, vt.envKey, vt.token, targets);
          logger.success(`Pushed to Vercel → ${vt.envKey} (${targets.join(', ')})`);
        }
      } catch (err) {
        logger.error(`Failed to sync ${vt.envKey}: ${err.message}`);
      }
    }

    logger.success('\nSync complete!');
  } catch (err) {
    if (err.response?.status === 401) {
      logger.error('Not authenticated. Run: vaultify login');
    } else {
      logger.error(`Sync failed: ${err.message}`);
    }
    process.exit(1);
  }
}

module.exports = sync;
