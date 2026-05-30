const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });

const { createConfig, VALIDATORS } = require('@vaultify/utils');

const env = createConfig('audit-service', {
  PORT: { type: 'port', default: 3003, envVar: 'AUDIT_PORT' },
  NODE_ENV: { type: 'string', default: 'development', validate: VALIDATORS.oneOf(['development', 'production', 'test']) },
  MONGO_URI: { type: 'string', required: true, validate: VALIDATORS.mongoUri },
});

module.exports = { env };
