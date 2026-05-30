const { requireAuth } = require('@vaultify/auth');
const { env } = require('../config/env');

/**
 * Express middleware — validates JWT from Authorization header.
 * Wraps the shared @vaultify/auth middleware with the server's JWT secret.
 */
const authMiddleware = requireAuth(env.JWT_SECRET);

module.exports = { authMiddleware };
