const BUCKET_RESOLUTION_MS = 1000;

class SlidingWindowStore {
  constructor() {
    this.buckets = new Map();
    this.interval = setInterval(() => this.sweep(), 60_000);
    this.interval.unref();
  }

  _key(prefix, id, windowMs) {
    return `${prefix}:${id}:${windowMs}`;
  }

  _bucketKey(key, timeSlot) {
    return `${key}:${timeSlot}`;
  }

  _timeSlot(now, windowMs) {
    return Math.floor(now / BUCKET_RESOLUTION_MS);
  }

  increment(prefix, id, windowMs, max, now = Date.now()) {
    const key = this._key(prefix, id, windowMs);
    const slot = this._timeSlot(now);
    const bucketKey = this._bucketKey(key, slot);
    const windowStart = now - windowMs;

    let entry = this.buckets.get(key);
    if (!entry) {
      entry = { windowMs, slots: new Map(), total: 0, updatedAt: now };
      this.buckets.set(key, entry);
    }

    entry.updatedAt = now;

    for (const [sk, count] of entry.slots) {
      const slotTime = parseInt(sk.split(':').pop(), 10) * BUCKET_RESOLUTION_MS;
      if (slotTime < windowStart) {
        entry.total -= count;
        entry.slots.delete(sk);
      }
    }

    const current = entry.slots.get(bucketKey) || 0;
    entry.slots.set(bucketKey, current + 1);
    entry.total += 1;

    return { current: entry.total, limit: max, remaining: Math.max(0, max - entry.total), exceeded: entry.total > max };
  }

  get(prefix, id, windowMs, now = Date.now()) {
    const key = this._key(prefix, id, windowMs);
    const entry = this.buckets.get(key);
    if (!entry) return { current: 0, remaining: 0, exceeded: false };

    const windowStart = now - windowMs;
    let total = 0;
    for (const [sk, count] of entry.slots) {
      const slotTime = parseInt(sk.split(':').pop(), 10) * BUCKET_RESOLUTION_MS;
      if (slotTime >= windowStart) total += count;
    }
    return { current: total, remaining: Math.max(0, total), exceeded: false };
  }

  sweep(now = Date.now()) {
    for (const [key, entry] of this.buckets) {
      if (now - entry.updatedAt > entry.windowMs * 2) {
        this.buckets.delete(key);
        continue;
      }
      const windowStart = now - entry.windowMs;
      for (const [sk, count] of entry.slots) {
        const slotTime = parseInt(sk.split(':').pop(), 10) * BUCKET_RESOLUTION_MS;
        if (slotTime < windowStart) {
          entry.total -= count;
          entry.slots.delete(sk);
        }
      }
    }
  }

  destroy() {
    clearInterval(this.interval);
    this.buckets.clear();
  }
}

module.exports = SlidingWindowStore;
