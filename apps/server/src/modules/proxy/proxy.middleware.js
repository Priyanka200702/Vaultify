const { proxyClient } = require('../../lib/axios');
const { validateToken } = require('../tokens/token.service');
const { getDecryptedKey } = require('../vault/vault.service');
const { getAuthConfig, buildTargetUrl } = require('./proxy.service');
const { logRequest } = require('@vaultify/logger');
const { AuditLog } = require('@vaultify/db');

/**
 * 🔥 Core Proxy Middleware
 *
 * Flow:
 * 1. Extract vlt_ token from Authorization header
 * 2. Validate token (6-step pipeline)
 * 3. Decrypt real API key from vault (in memory only)
 * 4. Replace Authorization header with real key
 * 5. Forward request to provider
 * 6. Stream response back to caller
 * 7. Log the call async, clear key from memory
 */
async function proxyMiddleware(req, res) {
  const startTime = Date.now();
  const provider = req.params.provider;
  const path = req.params[0] || '';

  // --- Step 1: Extract proxy token ---
  const authHeader = req.headers.authorization || req.headers['x-api-key'] || '';
  let tokenString = '';

  if (authHeader.startsWith('Bearer ')) {
    tokenString = authHeader.slice(7);
  } else if (authHeader.startsWith('vlt_')) {
    tokenString = authHeader;
  } else {
    return res.status(401).json({
      error: 'MISSING_TOKEN',
      message: 'Authorization header must contain a Vaultify proxy token (vlt_...)',
    });
  }

  // --- Step 2: Validate token (6-step pipeline) ---
  const requestedEndpoint = `${req.method} /${path}`;
  const callerIp = req.ip || req.connection?.remoteAddress || 'unknown';
  const validation = await validateToken(tokenString, requestedEndpoint, callerIp);

  if (!validation.valid) {
    return res.status(403).json({
      error: validation.code,
      message: validation.error,
    });
  }

  const token = validation.token;

  // --- Step 3: Decrypt real API key (memory only) ---
  let realKey;
  try {
    realKey = await getDecryptedKey(token.vaultKeyId);
  } catch (err) {
    return res.status(500).json({
      error: 'KEY_DECRYPT_FAILED',
      message: 'Failed to retrieve the real API key from vault',
    });
  }

  // --- Step 4: Build target URL and inject real key ---
  const targetUrl = buildTargetUrl(provider, path);
  if (!targetUrl) {
    realKey = null; // Clear from scope
    return res.status(400).json({
      error: 'UNKNOWN_PROVIDER',
      message: `Unknown provider: ${provider}. Supported: anthropic, openai, stripe, github`,
    });
  }

  const authConfig = getAuthConfig(provider);

  // Build forwarded headers — strip proxy token, inject real key
  const forwardHeaders = { ...req.headers };
  delete forwardHeaders.host;
  delete forwardHeaders['content-length']; // Let axios recalculate
  delete forwardHeaders.authorization;
  delete forwardHeaders['x-api-key'];

  // Set the real auth header for the provider
  forwardHeaders[authConfig.header] = `${authConfig.prefix}${realKey}`;

  // --- Step 5: Forward request to provider ---
  let providerResponse;
  try {
    providerResponse = await proxyClient({
      method: req.method,
      url: targetUrl,
      headers: forwardHeaders,
      data: req.body,
      params: req.query,
      responseType: 'arraybuffer', // Handle all response types
    });
  } catch (err) {
    realKey = null; // Clear from scope
    const latencyMs = Date.now() - startTime;

    // Log the failed attempt
    logRequest(AuditLog, {
      tokenId: token._id,
      tokenString: token.tokenString,
      workspaceId: token.workspaceId,
      memberId: token.issuedTo,
      memberName: token.issuedToName,
      sourceIp: callerIp,
      endpoint: requestedEndpoint,
      provider,
      statusCode: err.response?.status || 502,
      latencyMs,
      requestSize: req.headers['content-length'] ? parseInt(req.headers['content-length']) : 0,
      responseSize: 0,
      environment: token.environment,
    });

    // Check for anomalies on error too
    setImmediate(() => {
      checkAnomalies(token._id, token.issuedTo, callerIp, requestedEndpoint, err.response?.status || 502);
    });

    return res.status(502).json({
      error: 'PROXY_FORWARD_FAILED',
      message: 'Failed to reach the provider API',
    });
  }

  // --- Step 6: Stream response back ---
  realKey = null; // Clear real key from memory immediately

  // Forward response headers
  const responseHeaders = providerResponse.headers;
  for (const [key, value] of Object.entries(responseHeaders)) {
    if (!['transfer-encoding', 'connection', 'content-encoding'].includes(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  }

  res.status(providerResponse.status).send(Buffer.from(providerResponse.data));

  // --- Step 7: Log async (non-blocking) ---
  const latencyMs = Date.now() - startTime;
  logRequest(AuditLog, {
    tokenId: token._id,
    tokenString: token.tokenString,
    workspaceId: token.workspaceId,
    memberId: token.issuedTo,
    memberName: token.issuedToName,
    sourceIp: callerIp,
    endpoint: requestedEndpoint,
    provider,
    statusCode: providerResponse.status,
    latencyMs,
    requestSize: req.headers['content-length'] ? parseInt(req.headers['content-length']) : 0,
    responseSize: providerResponse.data ? providerResponse.data.length : 0,
    environment: token.environment,
  });
}

module.exports = { proxyMiddleware };
