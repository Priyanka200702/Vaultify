const express = require('express');
const { proxyMiddleware } = require('./modules/proxy/proxy.middleware');
const { proxyMultiLimiter } = require('./middleware/rateLimiter');

const app = express();

app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check — required for deployment orchestration
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'proxy-service', timestamp: new Date().toISOString() });
});

app.all('/proxy/:provider/*', ...proxyMultiLimiter, proxyMiddleware);

// Catch-all 404
app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` });
});

app.use((err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  console.error('[Proxy] Unhandled error:', err.stack || err.message);
  res.status(statusCode).json({ error: 'INTERNAL_ERROR', message: err.expose ? err.message : 'An unexpected error occurred' });
});

module.exports = app;
