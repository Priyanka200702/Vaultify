const inquirer = require('inquirer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('../utils/logger');
const { storeToken, deleteToken } = require('../services/keychain');

const configDir = path.join(os.homedir(), '.vaultify');
const configPath = path.join(configDir, 'config.json');

async function login() {
  try {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'serverUrl',
        message: 'Vaultify server URL:',
        default: 'http://localhost:3001',
      },
      {
        type: 'input',
        name: 'email',
        message: 'Email:',
        validate: (input) => input.includes('@') || 'Enter a valid email',
      },
      {
        type: 'password',
        name: 'password',
        message: 'Password:',
        mask: '*',
        validate: (input) => input.length >= 6 || 'Password must be at least 6 characters',
      },
    ]);

    const spin = logger.spinner('Authenticating...').start();

    const response = await axios.post(`${answers.serverUrl}/api/auth/login`, {
      email: answers.email,
      password: answers.password,
    });

    const { accessToken } = response.data;
    spin.succeed('Authenticated');

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(
      configPath,
      JSON.stringify({ serverUrl: answers.serverUrl }, null, 2)
    );

    await storeToken(accessToken);

    logger.success('Login successful!');
    logger.info(`Server: ${answers.serverUrl}`);
    logger.info('Auth token stored securely in OS keychain');
  } catch (err) {
    if (err.response) {
      logger.error(`Login failed: ${err.response.data.message || err.response.statusText}`);
    } else {
      logger.error(`Login failed: ${err.message}`);
    }
    process.exit(1);
  }
}

module.exports = login;
