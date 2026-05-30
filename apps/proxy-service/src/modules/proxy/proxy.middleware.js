const crypto = require('crypto');
const { proxyClient, STREAM_TIMEOUT, DEFAULT_TIMEOUT } = require('../../lib/axios');
const { decryptKey } = require('../../lib/adminClient');
const { sendAuditLog } = require('../../lib/auditClient');
const { validateToken } = require('../tokens/token.service');
const { getAuthConfig, buildTargetUrl } = require('./proxy.service');
const { inspectBody } = require('../../middleware/bodyInspector');
const { sanitizeHeaders, sanitizeHeadersExpress } = require('../../middleware/responseSanitizer');
const { lockoutCheck, wrapAnomalyCheck, preFlightCheck } = require('../../middleware/anomaly.middleware');
const { extractCanonicalToken } = require('@vaultify/utils');

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

async function proxyMiddleware(req, res, next) {
  try {
    const startTime = Date.now();
    const provider = req.params.provider;
    const path = req.params[0] || '';

    const authHeader = req.headers.authorization || req.headers['x-api-key'] || '';
    let tokenString = '';
    if (authHeader.startsWith('Bearer ')) tokenString = authHeader.slice(7);
    else tokenString = authHeader;
    if (!tokenString) return res.status(401).json({ error: 'MISSING_TOKEN', message: 'Authorization header must contain a Vaultify proxy token' });
    tokenString = extractCanonicalToken(tokenString) || tokenString;

    const requestedEndpoint = `${req.method} /${path}`;
    const callerIp = req.ip || req.connection?.remoteAddress || 'unknown';

    let validation;
    try {
      validation = await validateToken(tokenString, requestedEndpoint, callerIp);
    } catch (err) {
      return next(Object.assign(err, { statusCode: 503, code: 'TOKEN_VALIDATION_FAILED' }));
    }
    if (!validation.valid) return res.status(403).json({ error: validation.code, message: validation.error });
    const token = validation.token;

    // Synchronous pre-flight Zero Trust gate — scores request BEFORE key decryption
    const tokenId = token._id?.toString();
    const preFlightFeatures = {
      endpoint: requestedEndpoint,
      requestSize: req.headers['content-length'] ? parseInt(req.headers['content-length']) : 0,
    };
    const preFlight = preFlightCheck(tokenId, preFlightFeatures);
    if (preFlight.locked) {
      return res.status(429).json({
        error: 'TOKEN_LOCKED',
        message: `Token temporarily locked due to anomalous activity. Retry after ${Math.ceil(preFlight.remainingMs / 1000)}s.`,
        retryAfterSeconds: Math.ceil(preFlight.remainingMs / 1000),
      });
    }

    let keyBuf;
    try {
      const rawKey = await decryptKey(token.vaultKeyId);
      keyBuf = buildKeyBuffer(rawKey);
    } catch (err) {
      err.expose = true;
      err.statusCode = 502;
      err.code = 'KEY_DECRYPT_FAILED';
      throw err;
    }

    const targetUrl = buildTargetUrl(provider, path);
    if (!targetUrl) {
      disposeKeyBuffer(keyBuf);
      return res.status(400).json({ error: 'UNKNOWN_PROVIDER', message: `Unknown provider: ${provider}` });
    }

    const authConfig = getAuthConfig(provider);
    const bodyInspection = inspectBody(req);

    const forwardHeaders = { ...req.headers };
    delete forwardHeaders.host;
    delete forwardHeaders['content-length'];
    delete forwardHeaders.authorization;
    delete forwardHeaders['x-api-key'];

    const authHeaderValue = `${authConfig.prefix}${keyBuf.toString('utf-8')}`;
    forwardHeaders[authConfig.header] = authHeaderValue;
    disposeKeyBuffer(keyBuf);

    const isStreaming = !!(req.body && req.body.stream === true);
    const requestTimeout = isStreaming ? STREAM_TIMEOUT : DEFAULT_TIMEOUT;

    let providerResponse;
    try {
      providerResponse = await proxyClient({
        method: req.method, url: targetUrl, headers: forwardHeaders,
        data: req.body, params: req.query, responseType: 'arraybuffer',
        timeout: requestTimeout,
      });
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      await sendAuditLog({
        tokenId: token._id, tokenString: token.tokenString, workspaceId: token.workspaceId,
        memberId: token.issuedTo, memberName: token.issuedToName,
        sourceIp: callerIp, endpoint: requestedEndpoint, provider,
        requestBodySnippet: bodyInspection.snippet, requestBodyFormat: bodyInspection.format,
        injectionPatterns: bodyInspection.patterns,
        statusCode: err.response?.status || 502, latencyMs,
        requestSize: req.headers['content-length'] ? parseInt(req.headers['content-length']) : 0,
        responseSize: 0, environment: token.environment,
      });
      wrapAnomalyCheck(tokenId, token.issuedTo, callerIp, requestedEndpoint, err.response?.status || 502);
      return res.status(502).json({ error: 'PROXY_FORWARD_FAILED', message: 'Failed to reach the provider API' });
    }

    const sanitizedResHeaders = sanitizeHeaders(providerResponse.headers);
    sanitizeHeadersExpress(providerResponse.headers, res);
    res.status(providerResponse.status).send(Buffer.from(providerResponse.data));

    const latencyMs = Date.now() - startTime;
    setImmediate(() => {
      sendAuditLog({
        tokenId: token._id, tokenString: token.tokenString, workspaceId: token.workspaceId,
        memberId: token.issuedTo, memberName: token.issuedToName,
        sourceIp: callerIp, endpoint: requestedEndpoint, provider,
        requestBodySnippet: bodyInspection.snippet, requestBodyFormat: bodyInspection.format,
        injectionPatterns: bodyInspection.patterns,
        responseHeaders: sanitizedResHeaders,
        statusCode: providerResponse.status, latencyMs,
        requestSize: req.headers['content-length'] ? parseInt(req.headers['content-length']) : 0,
        responseSize: providerResponse.data ? providerResponse.data.length : 0,
        environment: token.environment,
      }).catch((auditErr) => {
        console.error('[Proxy] Fire-and-forget audit log failed:', auditErr.message);
      });
      wrapAnomalyCheck(tokenId, token.issuedTo, callerIp, requestedEndpoint, providerResponse.status);
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { proxyMiddleware };
