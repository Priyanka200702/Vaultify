const { Router } = require('express');
const { proxyMiddleware } = require('./proxy.middleware');
const { proxyLimiter } = require('../../middleware/rateLimiter');

const router = Router();

// All proxy routes — no JWT auth required (uses proxy token instead)
// Rate limited at 200 req/min per IP
router.all('/:provider/*', proxyLimiter, proxyMiddleware);

module.exports = router;
