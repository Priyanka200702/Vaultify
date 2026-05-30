const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });

const { createConfig, VALIDATORS } = require('@vaultify/utils');

const env = createConfig('proxy-service', {
  PORT: { type: 'port', default: 3001, envVar: 'PROXY_PORT' },
  NODE_ENV: { type: 'string', default: 'development', validate: VALIDATORS.oneOf(['development', 'production', 'test']) },
  MONGO_URI: { type: 'string', required: true, validate: VALIDATORS.mongoUri },
  ADMIN_SERVICE_URL: { type: 'string', default: 'http://localhost:3002', validate: VALIDATORS.url },
  AUDIT_SERVICE_URL: { type: 'string', default: 'http://localhost:3003', validate: VALIDATORS.url },
  INTERNAL_API_KEY: { type: 'string', required: true, validate: VALIDATORS.minLength(32) },
  PROXY_TLS_CERT: { type: 'string', default: null, validate: VALIDATORS.file },
  PROXY_TLS_KEY: { type: 'string', default: null, validate: VALIDATORS.file },
  TLS_CA: { type: 'string', default: null, validate: VALIDATORS.file },
});

module.exports = { env };
