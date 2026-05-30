const { ProxyToken, AuditLog } = require('@vaultify/db');
const { validateTokenFormat, ipAllowed, rollingWindowCount, checkScope, methodToScope } = require('@vaultify/utils');
const { DEFAULT_TOKEN_EXPIRY } = require('../../config/constants');

async function validateToken(tokenString, requestedEndpoint, callerIp) {
  try {
    if (!validateTokenFormat(tokenString)) {
      return { valid: false, token: null, error: 'Invalid token format', code: 'TOKEN_FORMAT_INVALID' };
    }

    const token = await ProxyToken.findOne({ tokenString }).lean();
    if (!token) {
      return { valid: false, token: null, error: 'Token not found', code: 'TOKEN_NOT_FOUND' };
    }
    if (token.revokedAt) {
      return { valid: false, token: null, error: 'Token has been revoked', code: 'TOKEN_REVOKED' };
    }
    if (token.expiresAt && new Date() > new Date(token.expiresAt)) {
      return { valid: false, token: null, error: 'Token has expired', code: 'TOKEN_EXPIRED' };
    }

    if (token.allowedEndpoints && token.allowedEndpoints.length > 0 && requestedEndpoint) {
      const isEndpointAllowed = token.allowedEndpoints.some((allowed) => {
        if (allowed === '*') return true;
        return allowed.toUpperCase() === requestedEndpoint.toUpperCase();
      });
      if (!isEndpointAllowed) {
        return { valid: false, token: null, error: `Endpoint ${requestedEndpoint} not allowed for this token`, code: 'ENDPOINT_NOT_ALLOWED' };
      }
    }

    if (token.scopes && token.scopes.length > 0 && requestedEndpoint) {
      const method = requestedEndpoint.split(' ')[0] || 'GET';
      const requiredScope = methodToScope(method);
      if (!checkScope(token.scopes, requiredScope)) {
        return { valid: false, token: null, error: `Token scope '${token.scopes.join(',')}' does not include '${requiredScope}'`, code: 'SCOPE_NOT_ALLOWED' };
      }
    }

    if (token.allowedIps && token.allowedIps.length > 0 && callerIp) {
      if (!ipAllowed(callerIp, token.allowedIps)) {
        return { valid: false, token: null, error: `IP ${callerIp} not allowed for this token`, code: 'IP_NOT_ALLOWED' };
      }
    }

    if (token.rateLimitDaily) {
      const count = await rollingWindowCount(AuditLog, token._id.toString(), 24);
      if (count >= token.rateLimitDaily) {
        return { valid: false, token: null, error: `Daily rate limit (${token.rateLimitDaily}) exceeded`, code: 'RATE_LIMIT_EXCEEDED' };
      }
    }

    return { valid: true, token, error: null, code: null };
  } catch (err) {
    console.error('[TokenService] validateToken error:', err.message);
    return { valid: false, token: null, error: 'Token validation failed due to an internal error', code: 'VALIDATION_INTERNAL_ERROR' };
  }
}

module.exports = { validateToken };
