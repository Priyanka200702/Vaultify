const { createRateLimiter } = require('@vaultify/ratelimit');

const globalLimiter = createRateLimiter({
  prefix: 'rl:global',
  windowMs: 60_000,
  max: 100,
  keyType: 'ip',
  message: 'Too many requests. Please try again later.',
});

const authLimiter = createRateLimiter({
  prefix: 'rl:auth',
  windowMs: 60_000,
  max: 10,
  keyType: 'ip',
  message: 'Too many authentication attempts. Please try again later.',
  enableSlowBurn: true,
});

const proxyLimiter = createRateLimiter({
  prefix: 'rl:proxy',
  windowMs: 60_000,
  max: 200,
  keyType: 'ip',
  message: 'Too many proxy requests. Please try again later.',
});

const userLimiter = createRateLimiter({
  prefix: 'rl:user',
  windowMs: 60_000,
  max: 300,
  keyType: 'user',
  message: 'User rate limit exceeded.',
});

const workspaceLimiter = createRateLimiter({
  prefix: 'rl:ws',
  windowMs: 60_000,
  max: 1000,
  keyType: 'workspace',
  message: 'Workspace rate limit exceeded.',
  enableSlowBurn: true,
});

const proxyMultiLimiter = [
  proxyLimiter,
  userLimiter,
  workspaceLimiter,
];

module.exports = { globalLimiter, authLimiter, proxyLimiter, userLimiter, workspaceLimiter, proxyMultiLimiter };
