const rateLimit = require('express-rate-limit');

/**
 * Global rate limiter — 100 requests per minute per IP.
 */
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMITED',
    message: 'Too many requests. Please try again later.',
  },
});

/**
 * Auth endpoint rate limiter — 10 requests per minute per IP.
 * Stricter to prevent brute force attacks.
 */
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMITED',
    message: 'Too many authentication attempts. Please try again later.',
  },
});

/**
 * Proxy endpoint rate limiter — 200 requests per minute per IP.
 * Higher limit since legitimate apps make many calls.
 */
const proxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMITED',
    message: 'Too many proxy requests. Please try again later.',
  },
});

module.exports = { globalLimiter, authLimiter, proxyLimiter };
