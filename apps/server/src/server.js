const { env, validateEnv } = require('./config/env');
const { initDatabase } = require('./config/db');
const app = require('./app');

async function start() {
  try {
    // Validate environment variables
    validateEnv();
    console.log('✅ Environment validated');

    // Connect to MongoDB
    await initDatabase();

    // Start HTTP server
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
