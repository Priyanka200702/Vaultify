const { env } = require('./config/env');
const { initDatabase } = require('./config/db');
const mongoose = require('mongoose');
const app = require('./app');

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
    await initDatabase();
    app.listen(env.PORT, () => {
      console.log(`\n🔐 Vaultify Server running on http://localhost:${env.PORT}`);
      console.log(`   Environment: ${env.NODE_ENV}`);
      console.log(`   Health:      http://localhost:${env.PORT}/health`);
      console.log(`   Proxy:       http://localhost:${env.PORT}/proxy/:provider/*`);
      console.log(`   API:         http://localhost:${env.PORT}/api/*\n`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
