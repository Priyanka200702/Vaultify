const { VaultKey } = require('@vaultify/db');
const { encryptKey, decryptKey } = require('../../services/encryption.service');
const { keyCache } = require('../../services/cache.service');

/**
 * Stores a real API key encrypted in the vault.
 */
async function storeKey(workspaceId, { name, provider, environment, rawKey }) {
  const encryptedKey = encryptKey(rawKey);

  // Save first 8 chars as prefix for display (e.g. "sk-ant-a***")
  const keyPrefix = rawKey.substring(0, 8) + '***';

  const vaultKey = await VaultKey.create({
    workspaceId,
    name,
    provider,
    environment,
    encryptedKey,
    keyPrefix,
  });

  return {
    id: vaultKey._id,
    name: vaultKey.name,
    provider: vaultKey.provider,
    environment: vaultKey.environment,
    keyPrefix: vaultKey.keyPrefix,
    createdAt: vaultKey.createdAt,
  };
}

/**
 * Rotates a real key — re-encrypts with new value.
 * All proxy tokens continue working (they reference the vault key ID, not the raw key).
 */
async function rotateKey(keyId, newRawKey) {
  const vaultKey = await VaultKey.findById(keyId);
  if (!vaultKey) throw new Error('Vault key not found');

  const encryptedKey = encryptKey(newRawKey);
  const keyPrefix = newRawKey.substring(0, 8) + '***';

  vaultKey.encryptedKey = encryptedKey;
  vaultKey.keyPrefix = keyPrefix;
  vaultKey.lastRotatedAt = new Date();
  await vaultKey.save();

  // Invalidate cache for this key
  keyCache.delete(keyId.toString());

  return {
    id: vaultKey._id,
    name: vaultKey.name,
    provider: vaultKey.provider,
    keyPrefix: vaultKey.keyPrefix,
    lastRotatedAt: vaultKey.lastRotatedAt,
  };
}

/**
 * Lists vault keys for a workspace — metadata only, NEVER the raw key.
 */
async function listKeys(workspaceId) {
  const keys = await VaultKey.find({ workspaceId })
    .select('-encryptedKey')
    .sort({ createdAt: -1 })
    .lean();

  return keys;
}

/**
 * Gets a single vault key metadata — NEVER the raw key.
 */
async function getKeyMeta(keyId) {
  const key = await VaultKey.findById(keyId).select('-encryptedKey').lean();
  return key;
}

/**
 * Decrypts and returns the real API key.
 * ⚠️  INTERNAL USE ONLY — called only by the proxy engine.
 * Uses in-memory cache to reduce DB reads under load.
 */
async function getDecryptedKey(keyId) {
  const cacheKey = keyId.toString();

  // Check cache first
  const cached = keyCache.get(cacheKey);
  if (cached) return cached;

  // Fetch from DB and decrypt
  const vaultKey = await VaultKey.findById(keyId);
  if (!vaultKey) throw new Error('Vault key not found');

  const rawKey = decryptKey(vaultKey.encryptedKey);

  // Cache for 60 seconds
  keyCache.set(cacheKey, rawKey);

  return rawKey;
}

/**
 * Deletes a vault key and invalidates cache.
 */
async function deleteKey(keyId) {
  const result = await VaultKey.findByIdAndDelete(keyId);
  keyCache.delete(keyId.toString());
  return result;
}

module.exports = { storeKey, rotateKey, listKeys, getKeyMeta, getDecryptedKey, deleteKey };
