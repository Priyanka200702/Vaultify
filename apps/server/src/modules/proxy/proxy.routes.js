const { Router } = require('express');
const { proxyMiddleware } = require('./proxy.middleware');
const { proxyMultiLimiter } = require('../../middleware/rateLimiter');

const router = Router();

// Multi-layer rate limiting: IP (200/min) + user (300/min) + workspace (1000/min)
router.all('/:provider/*', ...proxyMultiLimiter, proxyMiddleware);

module.exports = router;
