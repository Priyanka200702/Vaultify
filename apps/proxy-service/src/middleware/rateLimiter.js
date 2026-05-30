const { createRateLimiter } = require('@vaultify/ratelimit');

function providerKey(req) {
  const prov = req.params?.provider || 'unknown';
  return `${prov}:${req.ip || req.connection?.remoteAddress || 'unknown'}`;
}

function providerTokenKey(req) {
  const prov = req.params?.provider || 'unknown';
  return `${prov}:${req.token?.tokenString || req.ip}`;
}

const proxyLimiter = createRateLimiter({
  prefix: 'proxy:iplim',
  windowMs: 60_000,
  max: 200,
  keyFn: providerKey,
  message: 'Too many proxy requests.',
});

const tokenLimiter = createRateLimiter({
  prefix: 'proxy:token',
  windowMs: 60_000,
  max: 100,
  keyFn: providerTokenKey,
  message: 'Token rate limit exceeded.',
});

const proxyMultiLimiter = [proxyLimiter, tokenLimiter];

module.exports = { proxyLimiter, tokenLimiter, proxyMultiLimiter };
