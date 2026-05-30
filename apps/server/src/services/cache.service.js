const { KEY_CACHE_TTL } = require('../config/constants');

/**
 * Simple in-memory TTL cache for decrypted API keys.
 * Avoids repeated DB reads + decryption under load.
 * Keys auto-expire after KEY_CACHE_TTL (60s).
 */
class CacheService {
  constructor(ttl = KEY_CACHE_TTL) {
    this.cache = new Map();
    this.ttl = ttl;
  }

  /**
   * Gets a value from cache. Returns null if expired or missing.
   * @param {string} key
   * @returns {*|null}
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Sets a value in cache with TTL.
   * @param {string} key
   * @param {*} value
   */
  set(key, value) {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttl,
    });
  }

  /**
   * Removes a specific key from cache.
   * @param {string} key
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Clears all cached entries.
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Returns the number of active (non-expired) entries.
   */
  get size() {
    // Clean expired entries first
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
    return this.cache.size;
  }
}

// Singleton instance
const keyCache = new CacheService();

module.exports = { CacheService, keyCache };
