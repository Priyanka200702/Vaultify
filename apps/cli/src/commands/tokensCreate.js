const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const apiClient = require('../services/api');
const logger = require('../utils/logger');

let _cachedKeys = [];

async function createToken() {
  try {
    apiClient.requireAuth();
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'vaultKeyId',
        message: 'Select vault key:',
        choices: async () => {
          try {
            const response = await apiClient.get('/api/vault/keys');
            const keys = response.data.keys || response.data;
            _cachedKeys = keys || [];
            if (!keys || keys.length === 0) {
              return [{ name: 'No keys found - create one in dashboard', value: '' }];
            }
            return keys.map((k) => ({
              name: k.name + ' (' + k.provider + ')',
              value: k._id || k.id,
            }));
          } catch {
            return [{ name: 'Unable to load keys', value: '' }];
          }
        },
      },
      {
        type: 'list',
        name: 'environment',
        message: 'Environment:',
        choices: ['production', 'preview', 'development'],
        default: 'production',
      },
      {
        type: 'input',
        name: 'allowedEndpoints',
        message: 'Allowed endpoints (comma-separated):',
        default: 'POST /v1/messages, *',
      },
      {
        type: 'input',
        name: 'rateLimitDaily',
        message: 'Daily rate limit:',
        default: '500',
        validate: (input) => !isNaN(input) || 'Enter a number',
      },
    ]);

    if (!answers.vaultKeyId) {
      logger.error('No vault key selected');
      process.exit(1);
    }

    const endpoints = answers.allowedEndpoints.split(',').map((e) => e.trim());

    const response = await apiClient.post('/api/tokens', {
      vaultKeyId: answers.vaultKeyId,
      environment: answers.environment,
      allowedEndpoints: endpoints,
      rateLimitDaily: parseInt(answers.rateLimitDaily),
    });

    const token = response.data.token || response.data;
    const tokenStr = token.tokenString || token;

    const selectedKey = _cachedKeys.find((k) => (k._id || k.id) === answers.vaultKeyId);
    const keyName = selectedKey
      ? selectedKey.name.toUpperCase().replace(/[^A-Z0-9_]/g, '_') + '_TOKEN'
      : answers.vaultKeyId.substring(0, 8).toUpperCase() + '_TOKEN';

    console.log('');
    logger.success('Proxy token created!');
    logger.info('Token: ' + tokenStr);
    logger.info('Environment: ' + answers.environment);

    const { addToEnv } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'addToEnv',
        message: `Add ${keyName}=${tokenStr.substring(0, 15)}... to .env.vaultify?`,
        default: true,
      },
    ]);

    if (addToEnv) {
      const envPath = path.join(process.cwd(), '.env.vaultify');
      const line = `${keyName}=${tokenStr}`;

      if (fs.existsSync(envPath)) {
        fs.appendFileSync(envPath, '\n' + line);
      } else {
        fs.writeFileSync(envPath, `# Vaultify Proxy Tokens\n${line}\n`);
      }

      logger.success(`Appended to .env.vaultify: ${keyName}=${tokenStr.substring(0, 15)}...`);
    }
  } catch (err) {
    if (err.response?.status === 401) {
      logger.error('Not authenticated. Run: vaultify login');
    } else {
      logger.error('Failed to create token: ' + err.message);
    }
    process.exit(1);
  }
}

module.exports = createToken;
