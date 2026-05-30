const jwt = require('jsonwebtoken');

/**
 * Signs a JWT token.
 * @param {Object} payload - Data to encode in the token.
 * @param {string} secret - The signing secret.
 * @param {string} expiresIn - Expiration duration (e.g. '1h', '7d').
 * @returns {string} The signed JWT string.
 */
function signToken(payload, secret, expiresIn = '1h') {
  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * Verifies and decodes a JWT token.
 * @param {string} token - The JWT string.
 * @param {string} secret - The signing secret.
 * @returns {{ valid: boolean, decoded: Object | null, error: string | null }}
 */
function verifyToken(token, secret) {
  try {
    const decoded = jwt.verify(token, secret);
    return { valid: true, decoded, error: null };
  } catch (err) {
    return { valid: false, decoded: null, error: err.message };
  }
}

module.exports = { signToken, verifyToken };
