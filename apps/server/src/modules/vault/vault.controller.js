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

/**
 * POST /api/vault/keys — store a new key in the vault
 */
async function storeKey(req, res, next) {
  try {
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
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/vault/keys — list all keys (metadata only)
 */
async function listKeys(req, res, next) {
  try {
    const workspaceId = await resolveWorkspaceId(req);
    const keys = await vaultService.listKeys(workspaceId);
    res.json({ keys });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/vault/keys/:id/rotate — rotate a key
 */
async function rotateKey(req, res, next) {
  try {
    const { id } = req.params;
    const { newRawKey } = req.body;

    if (!newRawKey) {
      return res.status(400).json({ error: 'VALIDATION', message: 'newRawKey is required' });
    }

    const workspaceId = await resolveWorkspaceId(req);
    const result = await vaultService.rotateKey(id, newRawKey, workspaceId);
    res.json({ message: 'Key rotated successfully. All proxy tokens continue working.', key: result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/vault/keys/:id/tokens-count — get active proxy token count for a key
 */
async function getKeyTokenCount(req, res, next) {
  try {
    const { id } = req.params;
    const workspaceId = await resolveWorkspaceId(req);
    const count = await vaultService.getActiveTokenCount(id, workspaceId);
    res.json({ activeTokens: count });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/vault/keys/:id — delete a key and cascade-delete all its proxy tokens
 */
async function deleteKey(req, res, next) {
  try {
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
  } catch (err) {
    next(err);
  }
}

module.exports = { storeKey, listKeys, rotateKey, getKeyTokenCount, deleteKey };

