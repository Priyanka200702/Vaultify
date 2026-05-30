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

function providerKey(req) {
  const prov = req.params?.provider || 'unknown';
  return `${prov}:${req.ip || req.connection?.remoteAddress || 'unknown'}`;
}

function providerUserKey(req) {
  const prov = req.params?.provider || 'unknown';
  return `${prov}:${req.user?._id?.toString() || req.ip}`;
}

function providerWorkspaceKey(req) {
  const prov = req.params?.provider || 'unknown';
  return `${prov}:${req.user?.workspace?.toString() || req.user?._id?.toString() || req.ip}`;
}

const proxyLimiter = createRateLimiter({
  prefix: 'rl:proxy',
  windowMs: 60_000,
  max: 200,
  keyFn: providerKey,
  message: 'Too many proxy requests. Please try again later.',
});

const userLimiter = createRateLimiter({
  prefix: 'rl:user',
  windowMs: 60_000,
  max: 300,
  keyFn: providerUserKey,
  message: 'User rate limit exceeded.',
});

const workspaceLimiter = createRateLimiter({
  prefix: 'rl:ws',
  windowMs: 60_000,
  max: 1000,
  keyFn: providerWorkspaceKey,
  message: 'Workspace rate limit exceeded.',
  enableSlowBurn: true,
});

const proxyMultiLimiter = [
  proxyLimiter,
  userLimiter,
  workspaceLimiter,
];

module.exports = { globalLimiter, authLimiter, proxyLimiter, userLimiter, workspaceLimiter, proxyMultiLimiter };
