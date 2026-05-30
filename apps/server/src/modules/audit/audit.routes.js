const { Router } = require('express');
const { getRecentLogs } = require('@vaultify/logger');
const { AuditLog } = require('@vaultify/db');
const { authMiddleware } = require('../../middleware/auth.middleware');

const router = Router();

router.use(authMiddleware);

/**
 * GET /api/audit — paginated audit log with optional filters
 * Query params: page, limit, environment, tokenId
 */
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, environment, tokenId } = req.query;

    const result = await getRecentLogs(AuditLog, req.user.workspaceId, {
      page: parseInt(page),
      limit: parseInt(limit),
      environment,
      tokenId,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/audit/stats — summary stats for dashboard
 */
router.get('/stats', async (req, res, next) => {
  try {
    const workspaceId = req.user.workspaceId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalCalls, callsToday, blockedToday, avgLatency] = await Promise.all([
      AuditLog.countDocuments({ workspaceId }),
      AuditLog.countDocuments({ workspaceId, timestamp: { $gte: today } }),
      AuditLog.countDocuments({ workspaceId, statusCode: 403, timestamp: { $gte: today } }),
      AuditLog.aggregate([
        { $match: { workspaceId: require('mongoose').Types.ObjectId.createFromHexString(workspaceId.toString()) } },
        { $group: { _id: null, avgLatency: { $avg: '$latencyMs' } } },
      ]),
    ]);

    res.json({
      totalCalls,
      callsToday,
      blockedToday,
      avgLatency: avgLatency[0]?.avgLatency || 0,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/audit/export — export logs as CSV or JSON
 * Query params: format (csv|json), environment, startDate, endDate
 */
router.get('/export', async (req, res, next) => {
  try {
    const { format = 'json', environment, startDate, endDate } = req.query;

    const filter = { workspaceId: req.user.workspaceId };
    if (environment) filter.environment = environment;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(filter).sort({ timestamp: -1 }).lean();

    if (format === 'csv') {
      const csv = [
        'Timestamp,Token ID,Member,IP,Endpoint,Status Code,Latency (ms),Environment',
        ...logs.map(log => [
          new Date(log.timestamp).toISOString(),
          log.tokenId || 'N/A',
          log.memberName || 'Unknown',
          log.sourceIp || 'N/A',
          log.endpoint || 'N/A',
          log.statusCode || 'N/A',
          log.latencyMs || 0,
          log.environment || 'N/A',
        ].join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
      return res.send(csv);
    }

    // JSON format
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.json"');
    res.json({ logs, total: logs.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
