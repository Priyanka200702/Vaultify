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

    const result = await vaultService.rotateKey(id, newRawKey);
    res.json({ message: 'Key rotated successfully. All proxy tokens continue working.', key: result });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/vault/keys/:id — delete a key
 */
async function deleteKey(req, res, next) {
  try {
    const { id } = req.params;
    await vaultService.deleteKey(id);
    res.json({ message: 'Key deleted from vault' });
  } catch (err) {
    next(err);
  }
}

module.exports = { storeKey, listKeys, rotateKey, deleteKey };
