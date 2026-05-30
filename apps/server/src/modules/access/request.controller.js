const { asyncHandler } = require('@vaultify/utils');
const requestService = require('./request.service');

const submitRequest = asyncHandler(async (req, res) => {
  const { vaultKeyId, provider, environment, allowedEndpoints, rateLimitDaily, expiryDays, reason } = req.body;

  if (!vaultKeyId || !reason) {
    return res.status(400).json({ error: 'VALIDATION', message: 'vaultKeyId and reason are required' });
  }

  const request = await requestService.submitRequest({
    workspaceId: req.user.workspaceId,
    requesterId: req.user.userId,
    requesterName: req.user.name,
    requesterEmail: req.user.email,
    vaultKeyId,
    provider: provider || 'custom',
    environment: environment || 'development',
    allowedEndpoints: allowedEndpoints || [],
    rateLimitDaily: rateLimitDaily || 500,
    expiryDays: expiryDays || 7,
    reason,
  });

  res.status(201).json({
    message: 'Access request submitted',
    request,
    csrfState: request.csrfState,
  });
});

const listRequests = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const requests = await requestService.listRequests(req.user.workspaceId, status);
  res.json({ requests });
});

const approveRequest = asyncHandler(async (req, res) => {
  const { ownerNote, overrides, csrfState } = req.body;
  const mergedOverrides = { ...(overrides || {}), csrfState };
  const { request, token } = await requestService.approveRequest(req.params.id, ownerNote, mergedOverrides);
  res.json({
    message: 'Request approved — proxy token issued',
    request,
    token: {
      id: token._id,
      tokenString: token.tokenString,
      environment: token.environment,
      expiresAt: token.expiresAt,
    },
  });
});

const denyRequest = asyncHandler(async (req, res) => {
  const { ownerNote, csrfState } = req.body;
  const request = await requestService.denyRequest(req.params.id, ownerNote, { csrfState });
  res.json({ message: 'Request denied', request });
});

module.exports = { submitRequest, listRequests, approveRequest, denyRequest };
