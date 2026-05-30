const { Router } = require('express');
const { asyncHandler } = require('@vaultify/utils');
const { queryLogs, getStats, verifyChain, exportLogs } = require('../../lib/auditClient');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { requireScope } = require('../../middleware/requireScope');

const router = Router();

router.use(authMiddleware);
router.use(requireScope('audit:read'));

router.get('/', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, environment, tokenId } = req.query;
  const result = await queryLogs(req.user.workspaceId, { page, limit, environment, tokenId });
  res.json(result);
}));

router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await getStats(req.user.workspaceId);
  res.json(stats);
}));

router.get('/verify', asyncHandler(async (req, res) => {
  const result = await verifyChain(req.user.workspaceId);
  res.json(result);
}));

router.get('/export', asyncHandler(async (req, res) => {
  const result = await exportLogs(req.user.workspaceId, req.query);

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
