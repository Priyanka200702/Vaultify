const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });

const { createConfig, VALIDATORS } = require('@vaultify/utils');

const env = createConfig('admin-service', {
  PORT: { type: 'port', default: 3002, envVar: 'ADMIN_PORT' },
  PROXY_PORT: { type: 'port', default: 3001, envVar: 'PROXY_PORT' },
  AUDIT_PORT: { type: 'port', default: 3003, envVar: 'AUDIT_PORT' },
  AUDIT_SERVICE_URL: { type: 'string', default: null, envVar: 'AUDIT_SERVICE_URL' },
  NODE_ENV: { type: 'string', default: 'development', validate: VALIDATORS.oneOf(['development', 'production', 'test']) },
  MONGO_URI: { type: 'string', required: true, validate: VALIDATORS.mongoUri },
  JWT_SECRET: { type: 'string', required: true, validate: VALIDATORS.minLength(32) },
  REFRESH_TOKEN_SECRET: { type: 'string', required: true, validate: VALIDATORS.minLength(32) },
  ENCRYPTION_KEY: { type: 'string', required: true, validate: (v) => VALIDATORS.hex(v, 64) },
  KMS_PROVIDER: { type: 'string', default: 'local', envVar: 'KMS_PROVIDER' },
  INTERNAL_API_KEY: { type: 'string', default: '', validate: VALIDATORS.minLength(32) },
  PROXY_SERVICE_ENABLED: { type: 'boolean', default: true, envVar: 'PROXY_SERVICE_ENABLED' },
  VERCEL_API_TOKEN: { type: 'string', default: null },
  RESEND_API_KEY: { type: 'string', default: null },
  SLACK_WEBHOOK_URL: { type: 'string', default: null },
});

module.exports = { env };
