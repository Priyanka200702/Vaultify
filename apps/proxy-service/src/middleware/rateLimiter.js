const { createRateLimiter } = require('@vaultify/ratelimit');

const proxyLimiter = createRateLimiter({
  prefix: 'proxy:iplim',
  windowMs: 60_000,
  max: 200,
  keyType: 'ip',
  message: 'Too many proxy requests.',
});

const tokenLimiter = createRateLimiter({
  prefix: 'proxy:token',
  windowMs: 60_000,
  max: 100,
  keyFn: (req) => req.token?.tokenString || req.ip,
  message: 'Token rate limit exceeded.',
});

const proxyMultiLimiter = [proxyLimiter, tokenLimiter];

module.exports = { proxyLimiter, tokenLimiter, proxyMultiLimiter };
