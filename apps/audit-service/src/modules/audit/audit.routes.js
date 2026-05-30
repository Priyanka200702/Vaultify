const { Router } = require('express');
const { asyncHandler } = require('@vaultify/utils');
const { ingestAuditLog, queryAuditLogs, verifyChain, getStats, verifyChainByWorkspace, exportLogs } = require('./audit.service');

const router = Router();

router.post('/internal/audit/log', asyncHandler(async (req, res) => {
  const entry = await ingestAuditLog(req.body);
  res.status(201).json({ id: entry._id });
}));

function getWorkspaceId(req) {
  return req.headers['x-workspace-id'] || req.query.workspaceId;
}

router.get('/api/audit', asyncHandler(async (req, res) => {
  const { page, limit, environment, tokenId, tokenString } = req.query;
  const workspaceId = getWorkspaceId(req);
  if (!workspaceId) {
    return res.status(400).json({ error: 'WORKSPACE_REQUIRED', message: 'x-workspace-id header or workspaceId query param required' });
  }
  const result = await queryAuditLogs(workspaceId, { page: parseInt(page), limit: parseInt(limit), environment, tokenId, tokenString });
  res.json(result);
}));

router.get('/api/audit/stats', asyncHandler(async (req, res) => {
  const workspaceId = getWorkspaceId(req);
  if (!workspaceId) {
    return res.status(400).json({ error: 'WORKSPACE_REQUIRED', message: 'x-workspace-id header or workspaceId query param required' });
  }
  const stats = await getStats(workspaceId);
  res.json(stats);
}));

router.get('/api/audit/verify', asyncHandler(async (req, res) => {
  const workspaceId = getWorkspaceId(req);
  if (!workspaceId) {
    return res.status(400).json({ error: 'WORKSPACE_REQUIRED', message: 'x-workspace-id header or workspaceId query param required' });
  }
  const result = await verifyChainByWorkspace(workspaceId);
  res.json(result);
}));

router.get('/api/audit/verify/:id', asyncHandler(async (req, res) => {
  const result = await verifyChain(req.params.id);
  res.json(result);
}));

router.get('/api/audit/export', asyncHandler(async (req, res) => {
  const workspaceId = getWorkspaceId(req);
  if (!workspaceId) {
    return res.status(400).json({ error: 'WORKSPACE_REQUIRED', message: 'x-workspace-id header or workspaceId query param required' });
  }
  const result = await exportLogs(workspaceId, req.query);

  if (result.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
    return res.send(result.data);
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.json"');
  res.json(result.data);
}));

module.exports = router;
