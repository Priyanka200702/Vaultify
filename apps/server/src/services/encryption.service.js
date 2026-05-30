const { encryptWithDek, decryptWithDek, generateDek, wrapDek, unwrapDek } = require('@vaultify/crypto');
const { env } = require('../config/env');

function encryptKey(rawKey) {
  const dek = generateDek();
  const nonceCounter = 0;
  const encrypted = encryptWithDek(rawKey, dek, nonceCounter);
  const wrappedDek = wrapDek(dek, env.ENCRYPTION_KEY);
  return {
    wrappedDek,
    nonceCounter: nonceCounter + 1,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
    ciphertext: encrypted.ciphertext,
  };
}

function decryptKey(encryptedPayload) {
  const { wrappedDek, iv, authTag, ciphertext } = encryptedPayload;
  const dek = unwrapDek(wrappedDek, env.ENCRYPTION_KEY);
  return decryptWithDek({ iv, authTag, ciphertext }, dek);
}

function reEncryptKey(rawKey, existingEncryptedPayload) {
  const { wrappedDek, nonceCounter = 0 } = existingEncryptedPayload;
  const dek = unwrapDek(wrappedDek, env.ENCRYPTION_KEY);
  const encrypted = encryptWithDek(rawKey, dek, nonceCounter);
  return {
    wrappedDek,
    nonceCounter: nonceCounter + 1,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
    ciphertext: encrypted.ciphertext,
  };
}

module.exports = { encryptKey, decryptKey, reEncryptKey };
