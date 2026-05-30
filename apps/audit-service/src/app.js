const express = require('express');
const auditRoutes = require('./modules/audit/audit.routes');

const app = express();

app.use(express.json({ limit: '1mb' }));

app.use(auditRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'audit-service' }));

// Catch-all 404
app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` });
});

app.use((err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: err.message });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid resource identifier' });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: 'DUPLICATE', message: 'Resource already exists' });
  }

  console.error('[Audit] Error:', err.stack || err.message);
  res.status(statusCode).json({
    error: 'AUDIT_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
  });
});

module.exports = app;
