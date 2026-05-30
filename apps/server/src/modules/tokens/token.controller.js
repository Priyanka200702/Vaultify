const tokenService = require('./token.service');

/**
 * POST /api/tokens — issue a new proxy token
 */
async function issueToken(req, res, next) {
  try {
    const { vaultKeyId, allowedEndpoints, rateLimitDaily, allowedIps, environment, expiresInDays } = req.body;

    if (!vaultKeyId) {
      return res.status(400).json({ error: 'VALIDATION', message: 'vaultKeyId is required' });
    }

    const token = await tokenService.issueToken(vaultKeyId, req.user.workspaceId, {
      allowedEndpoints,
      rateLimitDaily,
      allowedIps,
      environment: environment || 'production',
      expiresInDays,
      issuedTo: req.user.userId,
      issuedToName: req.user.name,
    });

    res.status(201).json({
      message: 'Proxy token issued',
      token: {
        id: token._id,
        tokenString: token.tokenString,
        environment: token.environment,
        allowedEndpoints: token.allowedEndpoints,
        rateLimitDaily: token.rateLimitDaily,
        expiresAt: token.expiresAt,
        createdAt: token.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tokens — list tokens for workspace
 */
async function listTokens(req, res, next) {
  try {
    const includeRevoked = req.query.includeRevoked === 'true';
    const tokens = await tokenService.listTokens(req.user.workspaceId, includeRevoked);
    res.json({ tokens });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tokens/:id — get single token
 */
async function getToken(req, res, next) {
  try {
    const token = await tokenService.getToken(req.params.id);
    if (!token) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Token not found' });
    }
    res.json({ token });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/tokens/:id — revoke a token
 */
async function revokeToken(req, res, next) {
  try {
    const token = await tokenService.revokeToken(req.params.id);
    res.json({ message: 'Token revoked immediately', tokenId: token._id });
  } catch (err) {
    next(err);
  }
}

module.exports = { issueToken, listTokens, getToken, revokeToken };
