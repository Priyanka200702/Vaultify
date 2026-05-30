const SlidingWindowStore = require('./slidingWindowStore');
const SlowBurnDetector = require('./slowburn');

const store = new SlidingWindowStore();
const slowburn = new SlowBurnDetector();

setInterval(() => slowburn.sweep(), 120_000).unref();

const defaultKeyFns = {
  ip: (req) => req.ip || req.connection?.remoteAddress || 'unknown',
  user: (req) => req.user?._id?.toString() || req.ip,
  workspace: (req) => req.user?.workspace?.toString() || req.user?._id?.toString() || req.ip,
};

function createRateLimiter({
  prefix = 'rl',
  windowMs = 60_000,
  max = 100,
  keyType = 'ip',
  keyFn,
  skipFn = () => false,
  message = 'Too many requests. Please try again later.',
  enableSlowBurn = false,
} = {}) {
  const resolveKey = keyFn || defaultKeyFns[keyType] || defaultKeyFns.ip;

  return function rateLimiter(req, res, next) {
    if (skipFn(req)) return next();

    const key = resolveKey(req);
    const now = Date.now();

    if (enableSlowBurn) {
      slowburn.record(prefix, key, now);
      const burn = slowburn.check(prefix, key, now);
      if (burn.flagged) {
        res.set('X-Slow-Burn', 'true');
        res.set('X-Slow-Burn-Reason', burn.reason);
      }
    }

    const result = store.increment(prefix, key, windowMs, max, now);

    res.set('RateLimit-Limit', String(result.limit));
    res.set('RateLimit-Remaining', String(result.remaining));
    res.set('RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)));

    if (result.exceeded) {
      res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({ error: 'RATE_LIMITED', message });
    }

    next();
  };
}

module.exports = { createRateLimiter, store, slowburn, SlidingWindowStore, SlowBurnDetector };
