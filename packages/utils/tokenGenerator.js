const crypto = require('crypto');

// Base58 alphabet — no 0, O, I, l (avoids ambiguous characters)
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Encodes a Buffer to base58 string.
 * @param {Buffer} buffer
 * @returns {string}
 */
function toBase58(buffer) {
  let result = '';
  let num = BigInt('0x' + buffer.toString('hex'));
  const base = BigInt(58);

  while (num > 0n) {
    const remainder = Number(num % base);
    result = BASE58_ALPHABET[remainder] + result;
    num = num / base;
  }

  // Preserve leading zeros
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
    result = BASE58_ALPHABET[0] + result;
  }

  return result;
}

/**
 * Generates a Vaultify proxy token.
 * Format: vlt_{env}_{32 random bytes in base58}
 *
 * @param {'prod' | 'prev' | 'dev'} env - The environment segment.
 * @returns {string} The generated proxy token.
 */
function generateProxyToken(env = 'prod') {
  const validEnvs = ['prod', 'prev', 'dev'];
  if (!validEnvs.includes(env)) {
    throw new Error(`Invalid environment: ${env}. Must be one of: ${validEnvs.join(', ')}`);
  }

  const randomBytes = crypto.randomBytes(32);
  const randomPart = toBase58(randomBytes);

  return `vlt_${env}_${randomPart}`;
}

/**
 * Validates that a string matches the proxy token format.
 * @param {string} token
 * @returns {boolean}
 */
function validateTokenFormat(token) {
  if (!token || typeof token !== 'string') return false;

  const pattern = /^vlt_(prod|prev|dev)_[1-9A-HJ-NP-Za-km-z]{20,}$/;
  return pattern.test(token);
}

/**
 * Extracts the environment from a proxy token string.
 * @param {string} token
 * @returns {string | null}
 */
function extractTokenEnv(token) {
  if (!validateTokenFormat(token)) return null;
  const parts = token.split('_');
  return parts[1] || null;
}

module.exports = { generateProxyToken, validateTokenFormat, extractTokenEnv, toBase58 };
