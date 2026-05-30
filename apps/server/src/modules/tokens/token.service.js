const { ProxyToken, AuditLog } = require('@vaultify/db');
const { generateProxyToken, validateTokenFormat, ipAllowed, rollingWindowCount } = require('@vaultify/utils');
const { DEFAULT_RATE_LIMITS, DEFAULT_TOKEN_EXPIRY } = require('../../config/constants');

/**
 * Issues a new proxy token for a vault key.
 */
async function issueToken(vaultKeyId, workspaceId, scope = {}) {
  const {
    allowedEndpoints = [],
    rateLimitDaily = DEFAULT_RATE_LIMITS[scope.environment] || null,
    allowedIps = [],
    environment = 'production',
    expiresInDays = DEFAULT_TOKEN_EXPIRY[scope.environment] || null,
    issuedTo = null,
    issuedToName = null,
  } = scope;

  const envMap = { production: 'prod', preview: 'prev', development: 'dev' };
  const tokenString = generateProxyToken(envMap[environment] || 'prod');

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const token = await ProxyToken.create({
    tokenString,
    vaultKeyId,
    workspaceId,
    allowedEndpoints,
    rateLimitDaily,
    allowedIps,
    environment,
    expiresAt,
    issuedTo,
    issuedToName,
  });

  return token;
}

/**
 * Full 6-step token validation pipeline.
 * Returns { valid, token, error, code } — never fetches the real key if validation fails.
 */
async function validateToken(tokenString, requestedEndpoint, callerIp) {
  // Step 1: Syntactic check
  if (!validateTokenFormat(tokenString)) {
    return { valid: false, token: null, error: 'Invalid token format', code: 'TOKEN_FORMAT_INVALID' };
  }

  // Step 2: Exists in DB and not revoked
  const token = await ProxyToken.findOne({ tokenString }).lean();
  if (!token) {
    return { valid: false, token: null, error: 'Token not found', code: 'TOKEN_NOT_FOUND' };
  }
  if (token.revokedAt) {
    return { valid: false, token: null, error: 'Token has been revoked', code: 'TOKEN_REVOKED' };
  }

  // Step 3: Not expired
  if (token.expiresAt && new Date() > new Date(token.expiresAt)) {
    return { valid: false, token: null, error: 'Token has expired', code: 'TOKEN_EXPIRED' };
  }

  // Step 4: Endpoint allowed
  if (token.allowedEndpoints && token.allowedEndpoints.length > 0 && requestedEndpoint) {
    const isEndpointAllowed = token.allowedEndpoints.some((allowed) => {
      // Match "POST /v1/messages" or wildcard "*"
      if (allowed === '*') return true;
      return allowed.toUpperCase() === requestedEndpoint.toUpperCase();
    });

    if (!isEndpointAllowed) {
      return { valid: false, token: null, error: `Endpoint ${requestedEndpoint} not allowed for this token`, code: 'ENDPOINT_NOT_ALLOWED' };
    }
  }

  // Step 5: IP allowed
  if (token.allowedIps && token.allowedIps.length > 0 && callerIp) {
    if (!ipAllowed(callerIp, token.allowedIps)) {
      return { valid: false, token: null, error: `IP ${callerIp} not allowed for this token`, code: 'IP_NOT_ALLOWED' };
    }
  }

  // Step 6: Daily rate limit
  if (token.rateLimitDaily) {
    const count = await rollingWindowCount(AuditLog, token._id.toString(), 24);
    if (count >= token.rateLimitDaily) {
      return { valid: false, token: null, error: `Daily rate limit (${token.rateLimitDaily}) exceeded`, code: 'RATE_LIMIT_EXCEEDED' };
    }
  }

  return { valid: true, token, error: null, code: null };
}

/**
 * Revokes a proxy token immediately.
 */
async function revokeToken(tokenId) {
  const token = await ProxyToken.findById(tokenId);
  if (!token) throw new Error('Token not found');

  token.revokedAt = new Date();
  await token.save();
  return token;
}

/**
 * Lists tokens for a workspace.
 */
async function listTokens(workspaceId, includeRevoked = false) {
  const filter = { workspaceId };
  if (!includeRevoked) {
    filter.revokedAt = null;
  }

  const tokens = await ProxyToken.find(filter)
    .sort({ createdAt: -1 })
    .populate('vaultKeyId', 'name provider environment keyPrefix')
    .lean();

  return tokens;
}

/**
 * Gets a single token by ID.
 */
async function getToken(tokenId) {
  return ProxyToken.findById(tokenId)
    .populate('vaultKeyId', 'name provider environment keyPrefix')
    .lean();
}

module.exports = { issueToken, validateToken, revokeToken, listTokens, getToken };
