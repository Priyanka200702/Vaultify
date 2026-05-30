const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

/**
 * Decrypts ciphertext using AES-256-GCM.
 * @param {{ iv: string, authTag: string, ciphertext: string }} encrypted - Hex-encoded fields.
 * @param {string} encryptionKey - 32-byte hex-encoded key (64 hex chars).
 * @returns {string} The decrypted plaintext.
 */
function decrypt(encrypted, encryptionKey) {
  if (!encrypted || !encrypted.iv || !encrypted.authTag || !encrypted.ciphertext) {
    throw new Error('Encrypted payload must include iv, authTag, and ciphertext');
  }

  if (!encryptionKey || encryptionKey.length !== 64) {
    throw new Error('Encryption key must be a 64-character hex string (32 bytes)');
  }

  const key = Buffer.from(encryptionKey, 'hex');
  const iv = Buffer.from(encrypted.iv, 'hex');
  const authTag = Buffer.from(encrypted.authTag, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(encrypted.ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');

  return plaintext;
}

module.exports = { decrypt };
