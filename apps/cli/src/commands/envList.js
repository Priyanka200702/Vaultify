const vercelService = require('../services/vercel');
const logger = require('../utils/logger');

async function envList() {
  try {
    const vercelToken = process.env.VERCEL_TOKEN;
    if (!vercelToken) {
      logger.error('VERCEL_TOKEN not set. Set it with: export VERCEL_TOKEN=your_token');
      process.exit(1);
    }

    const vercelProjectId = process.env.VERCEL_PROJECT_ID;
    if (!vercelProjectId) {
      logger.error('VERCEL_PROJECT_ID not set. Set it with: export VERCEL_PROJECT_ID=your_project_id');
      process.exit(1);
    }

    const envVars = await vercelService.getEnvVars(vercelProjectId);

    if (!envVars || envVars.length === 0) {
      logger.info('No environment variables found for this project');
      return;
    }

    const tableData = envVars.map((ev) => {
      const isProxyToken = ev.value && ev.value.startsWith('vlt_');
      return {
        Key: ev.key,
        Value: isProxyToken ? ev.value.substring(0, 11) + '…' : '••••••••',
        Type: isProxyToken ? 'vaultify-token' : 'plain',
        Environments: (ev.target || ev.targets || []).join(', ') || 'all',
      };
    });

    logger.info(`Found ${envVars.length} environment variable(s)`);
    console.log('');
    logger.table(tableData);
  } catch (err) {
    logger.error(`Failed to fetch env vars: ${err.message}`);
    process.exit(1);
  }
}

module.exports = envList;
