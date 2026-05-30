const crypto = require('crypto');
const { AccessRequest, ProxyToken, User, Workspace } = require('@vaultify/db');
const { issueToken } = require('../tokens/token.service');
const { notifyAccessRequest, notifyRequestDecision } = require('../../services/notification.service');

function generateCsrfState() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Submits an access request.
 */
async function submitRequest(requestData) {
  const request = await AccessRequest.create({
    ...requestData,
    csrfState: generateCsrfState(),
  });

  // Notify owner
  const workspace = await Workspace.findById(requestData.workspaceId).populate('ownerId');
  if (workspace?.ownerId?.email) {
    await notifyAccessRequest(
      workspace.ownerId.email,
      requestData.requesterName,
      requestData.provider,
      requestData.environment
    );
  }

  return request;
}

/**
 * Lists access requests for a workspace.
 */
async function listRequests(workspaceId, status = null) {
  const filter = { workspaceId };
  if (status) filter.status = status;
  return AccessRequest.find(filter).sort({ createdAt: -1 }).lean();
}

/**
 * Approves an access request — auto-issues a proxy token.
 */
async function approveRequest(requestId, ownerNote = null, overrides = {}) {
  const request = await AccessRequest.findById(requestId);
  if (!request) throw new Error('Request not found');
  if (request.status !== 'pending') throw new Error('Request is not pending');
  if (overrides.csrfState && request.csrfState && overrides.csrfState !== request.csrfState) {
    throw new Error('Invalid CSRF state token');
  }

  // Apply overrides (owner can tighten scope)
  const scope = {
    allowedEndpoints: overrides.allowedEndpoints || request.allowedEndpoints,
    rateLimitDaily: overrides.rateLimitDaily || request.rateLimitDaily,
    environment: request.environment,
    expiresInDays: overrides.expiryDays || request.expiryDays,
    issuedTo: request.requesterId,
    issuedToName: request.requesterName,
  };

  // Auto-issue proxy token
  const token = await issueToken(request.vaultKeyId, request.workspaceId, scope);

  // Update request
  request.status = 'approved';
  request.ownerNote = ownerNote;
  request.issuedTokenId = token._id;
  request.resolvedAt = new Date();
  await request.save();

  // Notify requester
  const requester = await User.findById(request.requesterId);
  if (requester?.email) {
    await notifyRequestDecision(requester.email, 'approved', request.provider, token.tokenString);
  }

  return { request, token };
}

/**
 * Denies an access request.
 */
async function denyRequest(requestId, ownerNote, overrides = {}) {
  const request = await AccessRequest.findById(requestId);
  if (!request) throw new Error('Request not found');
  if (request.status !== 'pending') throw new Error('Request is not pending');
  if (overrides.csrfState && request.csrfState && overrides.csrfState !== request.csrfState) {
    throw new Error('Invalid CSRF state token');
  }

  request.status = 'denied';
  request.ownerNote = ownerNote || 'No reason provided';
  request.resolvedAt = new Date();
  await request.save();

  // Notify requester
  const requester = await User.findById(request.requesterId);
  if (requester?.email) {
    await notifyRequestDecision(requester.email, 'denied', request.provider);
  }

  return request;
}

module.exports = { submitRequest, listRequests, approveRequest, denyRequest };
