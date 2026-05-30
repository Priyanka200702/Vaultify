const { checkScope } = require('@vaultify/utils');

/**
 * Express middleware — checks that the authenticated user has the required scope.
 * Compatible with both user JWTs (req.user.scopes) and proxy tokens.
 * If req.user has no scopes field, passes through for backward compatibility.
 */
function requireScope(requiredScope) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    // User JWTs may not carry scopes; pass through for backward compat
    const userScopes = req.user.scopes;
    if (!userScopes || userScopes.length === 0) {
      return next();
    }

    if (checkScope(userScopes, requiredScope)) {
      return next();
    }

    res.status(403).json({
      error: 'FORBIDDEN',
      message: `Requires scope: ${requiredScope}`,
      requiredScope,
    });
  };
}

module.exports = { requireScope };
