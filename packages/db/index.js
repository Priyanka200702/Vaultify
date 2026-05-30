const mongoose = require('mongoose');

const User = require('./schemas/user.schema');
const VaultKey = require('./schemas/key.schema');
const ProxyToken = require('./schemas/token.schema');
const AuditLog = require('./schemas/audit.schema');
const Workspace = require('./schemas/workspace.schema');
const AccessRequest = require('./schemas/request.schema');

/**
 * Connects to MongoDB with retry logic.
 * @param {string} uri - MongoDB connection string.
 * @param {number} maxRetries - Max connection attempts (default 5).
 * @returns {Promise<typeof mongoose>}
 */
async function connectDB(uri, maxRetries = 5) {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      await mongoose.connect(uri, {
        dbName: 'vaultify',
      });
      console.log('✅ MongoDB connected successfully');
      return mongoose;
    } catch (err) {
      retries++;
      console.error(`❌ MongoDB connection attempt ${retries}/${maxRetries} failed: ${err.message}`);

      if (retries >= maxRetries) {
        throw new Error(`Failed to connect to MongoDB after ${maxRetries} attempts`);
      }

      // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      const delay = Math.pow(2, retries - 1) * 1000;
      console.log(`   Retrying in ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

module.exports = {
  connectDB,
  User,
  VaultKey,
  ProxyToken,
  AuditLog,
  Workspace,
  AccessRequest,
};
