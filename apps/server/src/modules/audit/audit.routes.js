const { Router } = require('express');
const { queryLogs, getStats, verifyChain, exportLogs } = require('../../lib/auditClient');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { requireScope } = require('../../middleware/requireScope');

const router = Router();

router.use(authMiddleware);
router.use(requireScope('audit:read'));

router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, environment, tokenId } = req.query;
    const result = await queryLogs(req.user.workspaceId, { page, limit, environment, tokenId });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const stats = await getStats(req.user.workspaceId);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

router.get('/verify', async (req, res, next) => {
  try {
    const result = await verifyChain(req.user.workspaceId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/export', async (req, res, next) => {
  try {
    const result = await exportLogs(req.user.workspaceId, req.query);

    if (result.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
      return res.send(result.data);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.json"');
    res.json(result.data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
