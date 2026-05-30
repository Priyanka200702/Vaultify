const { encryptWithDek, decryptWithDek, generateDek, createKmsProvider } = require('@vaultify/crypto');
const { env } = require('../config/env');

const kmsProvider = createKmsProvider(env.KMS_PROVIDER || 'local', { masterKey: env.ENCRYPTION_KEY });

async function encryptKey(rawKey) {
  const dek = generateDek();
  const nonceCounter = 0;
  const encrypted = encryptWithDek(rawKey, dek, nonceCounter);
  const wrappedDek = await kmsProvider.wrapDek(dek);
  return {
    wrappedDek,
    nonceCounter: nonceCounter + 1,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
    ciphertext: encrypted.ciphertext,
  };
}

async function decryptKey(encryptedPayload) {
  const { wrappedDek, iv, authTag, ciphertext } = encryptedPayload;
  const dek = await kmsProvider.unwrapDek(wrappedDek);
  return decryptWithDek({ iv, authTag, ciphertext }, dek);
}

async function reEncryptKey(rawKey, existingEncryptedPayload) {
  const { wrappedDek, nonceCounter = 0 } = existingEncryptedPayload;
  const dek = await kmsProvider.unwrapDek(wrappedDek);
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
