const { encrypt, decrypt } = require('@vaultify/crypto');
const { env } = require('../config/env');

/**
 * Encrypts a raw API key using the server's encryption key.
 * @param {string} rawKey - The plaintext API key.
 * @returns {{ iv: string, authTag: string, ciphertext: string }}
 */
function encryptKey(rawKey) {
  return encrypt(rawKey, env.ENCRYPTION_KEY);
}

/**
 * Decrypts an encrypted API key payload.
 * @param {{ iv: string, authTag: string, ciphertext: string }} encryptedPayload
 * @returns {string} The plaintext API key.
 */
function decryptKey(encryptedPayload) {
  return decrypt(encryptedPayload, env.ENCRYPTION_KEY);
}

module.exports = { encryptKey, decryptKey };
