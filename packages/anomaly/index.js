const crypto = require('crypto');

const WINDOW_SIZE = 100;
const MAD_THRESHOLD = 3.5;
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_WINDOW_MS = 300_000;
const LOCKOUT_DURATION_MS = [60_000, 300_000, 900_000, 3600_000];

class MemoryStore {
  constructor() {
    this._data = new Map();
  }

  get(key) {
    return this._data.get(key);
  }

  set(key, value) {
    this._data.set(key, value);
  }

  delete(key) {
    this._data.delete(key);
  }

  *entries(prefix) {
    for (const [key, value] of this._data) {
      if (key.startsWith(prefix)) yield [key, value];
    }
  }

  clear() {
    this._data.clear();
  }
}

class AnomalyDetector {
  constructor({ store } = {}) {
    this.store = store || new MemoryStore();
    this.interval = setInterval(() => this.sweep(), 60_000);
    this.interval.unref();
  }

  _key(prefix, id) {
    return `${prefix}:${id}`;
  }

  record(tokenId, features) {
    const key = this._key('anomaly', tokenId);
    let baseline = this.store.get(key);
    if (!baseline) {
      baseline = { window: [], createdAt: Date.now() };
      this.store.set(key, baseline);
    }

    baseline.window.push({ ...features, ts: Date.now() });
    if (baseline.window.length > WINDOW_SIZE) {
      baseline.window.shift();
    }
  }

  score(tokenId, features) {
    const key = this._key('anomaly', tokenId);
    const baseline = this.store.get(key);
    if (!baseline || baseline.window.length < 10) return 0;

    const scores = [];

    if (features.latencyMs != null) {
      scores.push(this._madScore(baseline.window.map(p => p.latencyMs), features.latencyMs));
    }

    if (features.requestSize != null && features.requestSize > 0) {
      scores.push(this._madScore(baseline.window.map(p => p.requestSize || 0), features.requestSize));
    }

    if (features.statusCode) {
      const errorRate = baseline.window.filter(p => (p.statusCode || 200) >= 400).length / baseline.window.length;
      if ((features.statusCode >= 400) !== (errorRate > 0.1)) {
        scores.push(1);
      }
    }

    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  }

  _madScore(history, value) {
    if (history.length < 5) return 0;
    const sorted = [...history].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const absDevs = history.map(v => Math.abs(v - median));
    const madArr = [...absDevs].sort((a, b) => a - b);
    const mad = madArr[Math.floor(madArr.length / 2)] || 1;
    const modifiedZ = 0.6745 * Math.abs(value - median) / mad;
    return modifiedZ;
  }

  checkLockout(tokenId) {
    const key = this._key('lockout', tokenId);
    const lockout = this.store.get(key);
    if (!lockout) return { locked: false };

    const elapsed = Date.now() - lockout.lockedAt;

    if (lockout.strike < LOCKOUT_THRESHOLD) {
      return { locked: false, strike: lockout.strike };
    }

    const duration = LOCKOUT_DURATION_MS[Math.min(lockout.strike - LOCKOUT_THRESHOLD, LOCKOUT_DURATION_MS.length - 1)];

    if (elapsed >= duration) {
      this.store.delete(key);
      return { locked: false };
    }

    return { locked: true, remainingMs: duration - elapsed, strike: lockout.strike };
  }

  recordAnomaly(tokenId) {
    const key = this._key('lockout', tokenId);
    let lockout = this.store.get(key);
    if (!lockout) {
      lockout = { strike: 0, lockedAt: 0 };
      this.store.set(key, lockout);
    }

    const now = Date.now();
    const elapsed = now - lockout.lockedAt;

    if (elapsed > LOCKOUT_WINDOW_MS) {
      lockout.strike = 0;
    }

    lockout.strike += 1;
    lockout.lockedAt = now;
    return { strike: lockout.strike, locked: lockout.strike >= LOCKOUT_THRESHOLD };
  }

  clearToken(tokenId) {
    this.store.delete(this._key('anomaly', tokenId));
    this.store.delete(this._key('lockout', tokenId));
  }

  sweep(now = Date.now()) {
    const cutoff = now - 3600_000;
    for (const [key, baseline] of this.store.entries('anomaly:')) {
      if (baseline.createdAt < cutoff) {
        this.store.delete(key);
      }
    }
    for (const [key, lockout] of this.store.entries('lockout:')) {
      if (now - lockout.lockedAt > LOCKOUT_DURATION_MS[LOCKOUT_DURATION_MS.length - 1] * 2) {
        this.store.delete(key);
      }
    }
  }

  destroy() {
    clearInterval(this.interval);
    this.store.clear();
  }
}

module.exports = AnomalyDetector;
module.exports.MemoryStore = MemoryStore;
module.exports.MAD_THRESHOLD = MAD_THRESHOLD;
module.exports.createMiddleware = function createMiddleware(detector) {
  function wrapAnomalyCheck(tokenId, issuedTo, callerIp, endpoint, statusCode) {
    setImmediate(async () => {
      try {
        const features = { latencyMs: 0, statusCode, endpoint };
        detector.record(tokenId, features);
        const score = detector.score(tokenId, features);
        if (score > MAD_THRESHOLD) {
          const result = detector.recordAnomaly(tokenId);
          console.error(`[ANOMALY] token=${tokenId} score=${score.toFixed(2)} strike=${result.strike}`);
        }
      } catch (err) {
        console.error('[ANOMALY] check error:', err.message);
      }
    });
  }

  function lockoutCheck(tokenId) {
    return detector.checkLockout(tokenId);
  }

  return { wrapAnomalyCheck, lockoutCheck, detector };
};
