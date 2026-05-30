const { connectDB } = require('@vaultify/db');
const { env } = require('./env');

async function initDatabase() {
  return connectDB(env.MONGO_URI);
}

module.exports = { initDatabase };
