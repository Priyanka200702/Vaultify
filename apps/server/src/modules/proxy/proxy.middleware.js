const crypto = require('crypto');
const { proxyClient, STREAM_TIMEOUT, DEFAULT_TIMEOUT } = require('../../lib/axios');
const { validateToken } = require('../tokens/token.service');
const { getDecryptedKey } = require('../vault/vault.service');
const { getAuthConfig, buildTargetUrl } = require('./proxy.service');
const { logRequest } = require('@vaultify/logger');
const { AuditLog } = require('@vaultify/db');
const { inspectBody } = require('../../middleware/bodyInspector');
const { sanitizeHeadersExpress, sanitizeHeaders } = require('../../middleware/responseSanitizer');
const { lockoutCheck, wrapAnomalyCheck, preFlightCheck } = require('../../middleware/anomaly.middleware');
const { extractCanonicalToken } = require('@vaultify/utils');

function zeroKey(key) {
  if (!key) return;
  const buf = Buffer.from(key, 'utf-8');
  buf.fill(0);
  const rand = crypto.randomBytes(buf.length);
  rand.copy(buf);
  buf.fill(0);
}

function buildKeyBuffer(rawKey) {
  const buf = Buffer.from(rawKey, 'utf-8');
  const zeroed = Buffer.alloc(buf.length);
  buf.copy(zeroed);
  buf.fill(0);
  return zeroed;
}

function disposeKeyBuffer(buf) {
  if (!buf) return;
  buf.fill(0);
  const rand = crypto.randomBytes(buf.length);
  rand.copy(buf);
  buf.fill(0);
}

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
async function proxyMiddleware(req, res, next) {
  try {
    const startTime = Date.now();
  const provider = req.params.provider;
  const path = req.params[0] || '';

  // --- Step 1: Extract proxy token ---
  const authHeader = req.headers.authorization || req.headers['x-api-key'] || '';
  let tokenString = '';

  if (authHeader.startsWith('Bearer ')) {
    tokenString = authHeader.slice(7);
  } else {
    tokenString = authHeader;
  }
  if (!tokenString) {
    return res.status(401).json({ error: 'MISSING_TOKEN', message: 'Authorization header must contain a Vaultify proxy token' });
  }
  tokenString = extractCanonicalToken(tokenString) || tokenString;

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

  // --- Step 2a: Pre-flight Zero Trust gate ---
  const preFlightFeatures = {
    endpoint: requestedEndpoint,
    requestSize: req.headers['content-length'] ? parseInt(req.headers['content-length']) : 0,
  };
  const preFlight = preFlightCheck(token._id?.toString(), preFlightFeatures);
  if (preFlight.locked) {
    return res.status(429).json({
      error: 'TOKEN_LOCKED',
      message: `Token temporarily locked due to anomalous activity. Retry after ${Math.ceil(preFlight.remainingMs / 1000)}s.`,
      retryAfterSeconds: Math.ceil(preFlight.remainingMs / 1000),
    });
  }

  // --- Step 3: Decrypt real API key (memory only) ---
  let realKey;
  let keyBuf;
  try {
    realKey = await getDecryptedKey(token.vaultKeyId);
    keyBuf = buildKeyBuffer(realKey);
    zeroKey(realKey);
    realKey = null;
  } catch (err) {
    err.expose = true;
    err.statusCode = 502;
    err.code = 'KEY_DECRYPT_FAILED';
    next(err);
    return;
  }

  // --- Step 4: Build target URL and inject real key ---
  const targetUrl = buildTargetUrl(provider, path);
  if (!targetUrl) {
    disposeKeyBuffer(keyBuf);
    return res.status(400).json({
      error: 'UNKNOWN_PROVIDER',
      message: `Unknown provider: ${provider}. Supported: anthropic, openai, stripe, github`,
    });
  }

  const authConfig = getAuthConfig(provider);

  // Capture body inspection before forwarding (must happen before body is consumed)
  const bodyInspection = inspectBody(req);

  // Build forwarded headers — strip proxy token, inject real key
  const forwardHeaders = { ...req.headers };
  delete forwardHeaders.host;
  delete forwardHeaders['content-length'];
  delete forwardHeaders.authorization;
  delete forwardHeaders['x-api-key'];

  const authHeaderValue = `${authConfig.prefix}${keyBuf.toString('utf-8')}`;
  forwardHeaders[authConfig.header] = authHeaderValue;
  disposeKeyBuffer(keyBuf);

  // --- Step 5: Forward request to provider ---
  const isStreaming = !!(req.body && req.body.stream === true);
  const requestTimeout = isStreaming ? STREAM_TIMEOUT : DEFAULT_TIMEOUT;
  let providerResponse;
  try {
    providerResponse = await proxyClient({
      method: req.method,
      url: targetUrl,
      headers: forwardHeaders,
      data: req.body,
      params: req.query,
      responseType: 'arraybuffer',
      timeout: requestTimeout,
    });
  } catch (err) {
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
      requestBodySnippet: bodyInspection.snippet,
      requestBodyFormat: bodyInspection.format,
      injectionPatterns: bodyInspection.patterns,
      statusCode: err.response?.status || 502,
      latencyMs,
      requestSize: req.headers['content-length'] ? parseInt(req.headers['content-length']) : 0,
      responseSize: 0,
      environment: token.environment,
    });

    wrapAnomalyCheck(token._id?.toString(), token.issuedTo, callerIp, requestedEndpoint, err.response?.status || 502);

    return res.status(502).json({
      error: 'PROXY_FORWARD_FAILED',
      message: 'Failed to reach the provider API',
    });
  }

  // --- Step 6: Stream response back with sanitized headers ---
  const sanitizedResHeaders = sanitizeHeaders(providerResponse.headers);
  sanitizeHeadersExpress(providerResponse.headers, res);

  res.status(providerResponse.status).send(Buffer.from(providerResponse.data));

  // --- Step 7: Log async (non-blocking) with body inspection + sanitized headers ---
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
    requestBodySnippet: bodyInspection.snippet,
    requestBodyFormat: bodyInspection.format,
    injectionPatterns: bodyInspection.patterns,
    responseHeaders: sanitizedResHeaders,
    statusCode: providerResponse.status,
    latencyMs,
    requestSize: req.headers['content-length'] ? parseInt(req.headers['content-length']) : 0,
    responseSize: providerResponse.data ? providerResponse.data.length : 0,
    environment: token.environment,
  });

  wrapAnomalyCheck(token._id?.toString(), token.issuedTo, callerIp, requestedEndpoint, providerResponse.status);
  } catch (err) {
    next(err);
  }
}

module.exports = { proxyMiddleware };
