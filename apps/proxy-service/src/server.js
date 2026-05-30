const { env } = require('./config/env');
const { connectDB } = require('@vaultify/db');
const mongoose = require('mongoose');

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err.stack || err.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason instanceof Error ? reason.stack : reason);
  process.exit(1);
});

mongoose.connection.on('error', (err) => {
  console.error('[DB] MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('[DB] MongoDB disconnected — attempting reconnect...');
});

async function start() {
  try {
    await connectDB(env.MONGO_URI);
    const app = require('./app');
    app.listen(env.PORT, () => {
      console.log(`✅ Vaultify Proxy Service running on port ${env.PORT}`);
      console.log(`   Admin service URL: ${env.ADMIN_SERVICE_URL}`);
      console.log(`   Audit service URL: ${env.AUDIT_SERVICE_URL}`);
    });
  } catch (err) {
    console.error('Failed to start proxy service:', err.message);
    process.exit(1);
  }
}

start();
