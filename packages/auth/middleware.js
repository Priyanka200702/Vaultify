const { verifyToken } = require('./jwt');

/**
 * Express middleware — validates JWT from Authorization header.
 * Attaches decoded user to req.user on success.
 * Expects: Authorization: Bearer <token>
 */
function requireAuth(jwtSecret) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Missing or invalid Authorization header',
      });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded, error } = verifyToken(token, jwtSecret);

    if (!valid) {
      return res.status(401).json({
        error: 'TOKEN_INVALID',
        message: `Authentication failed: ${error}`,
      });
    }

    req.user = decoded;
    next();
  };
}

/**
 * Express middleware — checks that the authenticated user has the required role.
 * Must be used after requireAuth.
 *
 * @param {...string} roles - Allowed roles (e.g. 'owner', 'member', 'viewer').
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `Requires one of roles: ${roles.join(', ')}`,
      });
    }

    next();
  };
}

module.exports = { requireAuth, requireRole };
