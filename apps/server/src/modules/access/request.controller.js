const requestService = require('./request.service');

async function submitRequest(req, res, next) {
  try {
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
  } catch (err) {
    next(err);
  }
}

async function listRequests(req, res, next) {
  try {
    const { status } = req.query;
    const requests = await requestService.listRequests(req.user.workspaceId, status);
    res.json({ requests });
  } catch (err) {
    next(err);
  }
}

async function approveRequest(req, res, next) {
  try {
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
  } catch (err) {
    if (err.message.includes('not pending') || err.message.includes('not found')) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: err.message });
    }
    next(err);
  }
}

async function denyRequest(req, res, next) {
  try {
    const { ownerNote, csrfState } = req.body;
    const request = await requestService.denyRequest(req.params.id, ownerNote, { csrfState });
    res.json({ message: 'Request denied', request });
  } catch (err) {
    next(err);
  }
}

module.exports = { submitRequest, listRequests, approveRequest, denyRequest };
