const crypto = require('crypto');
const { encrypt, decrypt } = require('./encrypt');
const { decrypt: aesDecrypt } = require('./decrypt');

const ALGORITHM = 'aes-256-gcm';
const AUTH_TAG_LENGTH = 16;
const NONCE_LENGTH = 12;
const DEK_LENGTH = 32;

function generateDek() {
  return crypto.randomBytes(DEK_LENGTH).toString('hex');
}

function deriveNonce(dekHex, counter) {
  const dek = Buffer.from(dekHex, 'hex');
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha256', dek);
  hmac.update(counterBuf);
  return hmac.digest().subarray(0, NONCE_LENGTH);
}

function wrapDek(dekHex, masterKeyHex) {
  const key = Buffer.from(masterKeyHex, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  let ciphertext = cipher.update(dekHex, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return { iv: iv.toString('hex'), authTag: authTag.toString('hex'), ciphertext };
}

function unwrapDek(wrappedDek, masterKeyHex) {
  const { iv, authTag, ciphertext } = wrappedDek;
  return aesDecrypt({ iv, authTag, ciphertext }, masterKeyHex);
}

function encryptWithDek(plaintext, dekHex, nonceCounter) {
  const nonce = deriveNonce(dekHex, nonceCounter);
  const key = Buffer.from(dekHex, 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, nonce, { authTagLength: AUTH_TAG_LENGTH });
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return { iv: nonce.toString('hex'), authTag: authTag.toString('hex'), ciphertext };
}

function decryptWithDek(encrypted, dekHex) {
  const { iv, authTag, ciphertext } = encrypted;
  const key = Buffer.from(dekHex, 'hex');
  const ivBuf = Buffer.from(iv, 'hex');
  const authTagBuf = Buffer.from(authTag, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuf);
  decipher.setAuthTag(authTagBuf);
  let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');
  return plaintext;
}

module.exports = { generateDek, deriveNonce, wrapDek, unwrapDek, encryptWithDek, decryptWithDek };
