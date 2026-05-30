const { asyncHandler } = require('@vaultify/utils');
const tokenService = require('./token.service');

const issueToken = asyncHandler(async (req, res) => {
  const { vaultKeyId, scopes, allowedEndpoints, rateLimitDaily, allowedIps, environment, expiresInDays, provider } = req.body;

  if (!vaultKeyId) {
    return res.status(400).json({ error: 'VALIDATION', message: 'vaultKeyId is required' });
  }

  const token = await tokenService.issueToken(vaultKeyId, req.user.workspaceId, {
    scopes,
    allowedEndpoints,
    rateLimitDaily,
    allowedIps,
    environment: environment || 'production',
    expiresInDays,
    issuedTo: req.user.userId,
    issuedToName: req.user.name,
    provider,
  });

  res.status(201).json({
    message: 'Proxy token issued',
    token: {
      id: token._id,
      tokenString: token.tokenString,
      environment: token.environment,
      scopes: token.scopes,
      allowedEndpoints: token.allowedEndpoints,
      rateLimitDaily: token.rateLimitDaily,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt,
    },
  });
});

const listTokens = asyncHandler(async (req, res) => {
  const includeRevoked = req.query.includeRevoked === 'true';
  const tokens = await tokenService.listTokens(req.user.workspaceId, includeRevoked);
  res.json({ tokens });
});

const getToken = asyncHandler(async (req, res) => {
  const token = await tokenService.getToken(req.params.id);
  if (!token) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Token not found' });
  }
  res.json({ token });
});

const revokeToken = asyncHandler(async (req, res) => {
  const token = await tokenService.revokeToken(req.params.id);
  res.json({ message: 'Token revoked immediately', tokenId: token._id });
});

module.exports = { issueToken, listTokens, getToken, revokeToken };
