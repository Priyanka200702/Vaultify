const express = require('express');
const cors = require('cors');
const { globalLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./modules/auth/auth.routes');
const mfaRoutes = require('./modules/auth/mfa.routes');
const vaultRoutes = require('./modules/vault/vault.routes');
const tokenRoutes = require('./modules/tokens/token.routes');
const proxyRoutes = require('./modules/proxy/proxy.routes');
const auditRoutes = require('./modules/audit/audit.routes');
const workspaceRoutes = require('./modules/workspace/workspace.routes');
const requestRoutes = require('./modules/access/request.routes');
const webhookRoutes = require('./modules/webhook/webhook.routes');

const app = express();

// ─────────────────────────── Global Middleware ───────────────────────────

// CORS — allow dashboard and CLI
app.use(cors({
  origin: [
    'http://localhost:5173',  // Vite dev server
    'http://localhost:3000',  // Alternate dev
    /\.vaultify\.dev$/,       // Production domains
  ],
  credentials: true,
}));

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Global rate limiter
app.use(globalLimiter);

// Trust proxy (for correct req.ip behind reverse proxy)
app.set('trust proxy', 1);

// ─────────────────────────── Health Check ───────────────────────────

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'vaultify-server',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─────────────────────────── API Routes ───────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/auth/mfa', mfaRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/webhooks', webhookRoutes);

// ─────────────────────────── Proxy Routes ───────────────────────────
// These are the core — deployed apps hit /proxy/:provider/*
app.use('/proxy', proxyRoutes);

// ─────────────────────────── 404 Handler ───────────────────────────

app.use((req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// ─────────────────────────── Error Handler ───────────────────────────

app.use(errorHandler);

module.exports = app;
