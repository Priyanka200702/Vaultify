const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });

const env = {
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  VERCEL_API_TOKEN: process.env.VERCEL_API_TOKEN || null,
  RESEND_API_KEY: process.env.RESEND_API_KEY || null,
  SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL || null,
};

/**
 * Validates that all required env vars are set.
 * Throws on missing critical vars.
 */
function validateEnv() {
  const required = ['MONGO_URI', 'JWT_SECRET', 'REFRESH_TOKEN_SECRET', 'ENCRYPTION_KEY'];
  const missing = required.filter((key) => !env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}\nCopy .env.example to .env and fill in values.`);
  }

  if (env.ENCRYPTION_KEY.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes for AES-256)');
  }

  if (env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
}

module.exports = { env, validateEnv };
