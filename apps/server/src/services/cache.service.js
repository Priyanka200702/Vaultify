const crypto = require('crypto');
const { KEY_CACHE_TTL } = require('../config/constants');

function zeroBuffer(buf) {
  if (!buf || buf.length === 0) return;
  buf.fill(0);
  const randomOverwrite = crypto.randomBytes(buf.length);
  randomOverwrite.copy(buf);
  buf.fill(0);
}

class SecureKeyHolder {
  constructor(ttl = KEY_CACHE_TTL) {
    this._cache = new Map();
    this._ttl = ttl;
    this._sweepInterval = setInterval(() => this._sweep(), this._ttl).unref();
    process.on('exit', () => this.clear());
    process.on('SIGINT', () => { this.clear(); process.exit(0); });
    process.on('SIGTERM', () => { this.clear(); process.exit(0); });
  }

  _sweep() {
    const now = Date.now();
    for (const [key, entry] of this._cache) {
      if (now > entry.expiresAt) {
        zeroBuffer(entry.value);
        this._cache.delete(key);
      }
    }
  }

  get(key) {
    const entry = this._cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      zeroBuffer(entry.value);
      this._cache.delete(key);
      return null;
    }
    return entry.value.toString('utf-8');
  }

  set(key, value) {
    const buf = Buffer.from(value, 'utf-8');
    this._cache.set(key, {
      value: buf,
      expiresAt: Date.now() + this._ttl,
    });
  }

  delete(key) {
    const entry = this._cache.get(key);
    if (entry) {
      zeroBuffer(entry.value);
    }
    this._cache.delete(key);
  }

  clear() {
    for (const [, entry] of this._cache) {
      zeroBuffer(entry.value);
    }
    this._cache.clear();
  }

  get size() {
    this._sweep();
    return this._cache.size;
  }
}

const keyCache = new SecureKeyHolder();

module.exports = { SecureKeyHolder, keyCache };
