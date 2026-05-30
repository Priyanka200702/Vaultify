const crypto = require('crypto');

class JtiStore {
  constructor() {
    this._store = new Map();
    this._sweepInterval = setInterval(() => this._sweep(), 60000).unref();
  }

  _sweep() {
    const now = Date.now();
    for (const [jti, entry] of this._store) {
      if (now > entry.expiresAt) {
        this._store.delete(jti);
      }
    }
  }

  markUsed(jti, ttlMs) {
    if (this._store.has(jti)) {
      return false;
    }
    this._store.set(jti, {
      usedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    });
    return true;
  }

  isUsed(jti) {
    const entry = this._store.get(jti);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this._store.delete(jti);
      return false;
    }
    return true;
  }

  size() {
    this._sweep();
    return this._store.size;
  }
}

const jtiStore = new JtiStore();

function generateJti() {
  return crypto.randomUUID();
}

module.exports = { jtiStore, generateJti };
