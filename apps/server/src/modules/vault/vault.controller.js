const { asyncHandler } = require('@vaultify/utils');
const { User } = require('@vaultify/db');
const vaultService = require('./vault.service');
const { createError } = require('../../middleware/errorHandler');

async function resolveWorkspaceId(req) {
  if (req.user?.workspaceId) {
    return req.user.workspaceId;
  }

  if (!req.user?.userId) {
    throw createError('Authentication payload is missing user context', 401, 'UNAUTHORIZED');
  }

  const user = await User.findById(req.user.userId).select('workspaceId').lean();
  if (!user?.workspaceId) {
    throw createError('Workspace context is missing for this session', 401, 'UNAUTHORIZED');
  }

  return user.workspaceId;
}

const storeKey = asyncHandler(async (req, res) => {
  const { name, provider, environment, rawKey } = req.body;

  if (!name || !provider || !rawKey) {
    return res.status(400).json({ error: 'VALIDATION', message: 'name, provider, and rawKey are required' });
  }

  const workspaceId = await resolveWorkspaceId(req);

  const result = await vaultService.storeKey(workspaceId, {
    name,
    provider,
    environment: environment || 'production',
    rawKey,
  });

  res.status(201).json({ message: 'Key stored in vault', key: result });
});

const listKeys = asyncHandler(async (req, res) => {
  const workspaceId = await resolveWorkspaceId(req);
  const keys = await vaultService.listKeys(workspaceId);
  res.json({ keys });
});

const rotateKey = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newRawKey } = req.body;

  if (!newRawKey) {
    return res.status(400).json({ error: 'VALIDATION', message: 'newRawKey is required' });
  }

  const workspaceId = await resolveWorkspaceId(req);
  const result = await vaultService.rotateKey(id, newRawKey, workspaceId);
  res.json({ message: 'Key rotated successfully. All proxy tokens continue working.', key: result });
});

const getKeyTokenCount = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const workspaceId = await resolveWorkspaceId(req);
  const count = await vaultService.getActiveTokenCount(id, workspaceId);
  res.json({ activeTokens: count });
});

const deleteKey = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const workspaceId = await resolveWorkspaceId(req);
  const result = await vaultService.deleteKey(id, workspaceId);

  if (!result) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Vault key not found' });
  }

  res.json({
    message: 'Key deleted from vault',
    deletedTokens: result.deletedTokens,
  });
});

module.exports = { storeKey, listKeys, rotateKey, getKeyTokenCount, deleteKey };

