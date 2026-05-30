const crypto = require('crypto');
const { AuditLog } = require('@vaultify/db');

function computeEntryHash(entry) {
  const hash = crypto.createHash('sha256');
  const fields = [
    entry.tokenString || '',
    entry.workspaceId?.toString() || '',
    entry.endpoint || '',
    entry.statusCode?.toString() || '',
    entry.timestamp?.toISOString() || new Date().toISOString(),
  ];
  hash.update(fields.join('|'));
  return hash.digest('hex');
}

async function getLastEntryHash() {
  const lastEntry = await AuditLog.findOne({}, { entryHash: 1 })
    .sort({ timestamp: -1 })
    .lean();
  return lastEntry?.entryHash || null;
}

async function ingestAuditLog(entry) {
  const prevHash = await getLastEntryHash();

  const doc = {
    tokenId: entry.tokenId,
    tokenString: entry.tokenString,
    workspaceId: entry.workspaceId,
    memberId: entry.memberId || null,
    memberName: entry.memberName || null,
    sourceIp: entry.sourceIp || 'unknown',
    endpoint: entry.endpoint || '',
    provider: entry.provider || '',
    requestBodySnippet: entry.requestBodySnippet || null,
    requestBodyFormat: entry.requestBodyFormat || null,
    injectionPatterns: entry.injectionPatterns || [],
    statusCode: entry.statusCode || 0,
    latencyMs: entry.latencyMs || 0,
    requestSize: entry.requestSize || 0,
    responseSize: entry.responseSize || 0,
    environment: entry.environment || 'development',
    timestamp: new Date(),
    prevEntryHash: prevHash,
    entryHash: null,
  };

  doc.entryHash = computeEntryHash(doc);
  const created = await AuditLog.create(doc);
  return created;
}

async function queryAuditLogs(workspaceId, options = {}) {
  const { page = 1, limit = 20, environment, tokenId, tokenString } = options;
  const filter = { workspaceId };
  if (environment) filter.environment = environment;
  if (tokenId) filter.tokenId = tokenId;
  if (tokenString) filter.tokenString = tokenString;

  const total = await AuditLog.countDocuments(filter);
  const logs = await AuditLog.find(filter)
    .sort({ timestamp: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function getStats(workspaceId) {
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

  return { totalCalls, callsToday, blockedToday, avgLatency: avgLatency[0]?.avgLatency || 0 };
}

async function verifyChainByWorkspace(workspaceId) {
  const logs = await AuditLog.find({ workspaceId })
    .sort({ timestamp: 1 })
    .lean();

  let broken = false;
  let prevHash = null;
  let verified = 0;

  for (const log of logs) {
    if (log.prevEntryHash !== prevHash) {
      broken = true;
      break;
    }
    const computed = computeEntryHash(log);
    if (computed !== log.entryHash) {
      broken = true;
      break;
    }
    prevHash = log.entryHash;
    verified++;
  }

  return {
    status: broken ? 'corrupted' : 'intact',
    totalEntries: logs.length,
    verifiedEntries: verified,
    firstEntry: logs[0]?.timestamp || null,
    lastEntry: logs[logs.length - 1]?.timestamp || null,
    lastEntryHash: logs[logs.length - 1]?.entryHash || null,
  };
}

async function exportLogs(workspaceId, options = {}) {
  const { format = 'json', environment, startDate, endDate } = options;

  const filter = { workspaceId };
  if (environment) filter.environment = environment;
  if (startDate || endDate) {
    filter.timestamp = {};
    if (startDate) filter.timestamp.$gte = new Date(startDate);
    if (endDate) filter.timestamp.$lte = new Date(endDate);
  }

  const logs = await AuditLog.find(filter).sort({ timestamp: -1 }).lean();

  if (format === 'csv') {
    const csv = [
      'Timestamp,Token ID,Member,IP,Endpoint,Status Code,Latency (ms),Environment,Entry Hash,Prev Entry Hash',
      ...logs.map(log => [
        new Date(log.timestamp).toISOString(),
        log.tokenId || 'N/A',
        log.memberName || 'Unknown',
        log.sourceIp || 'N/A',
        log.endpoint || 'N/A',
        log.statusCode || 'N/A',
        log.latencyMs || 0,
        log.environment || 'N/A',
        log.entryHash || 'N/A',
        log.prevEntryHash || 'N/A',
      ].join(',')),
    ].join('\n');
    return { format: 'csv', data: csv };
  }

  return {
    format: 'json',
    data: {
      workspaceId,
      exportTimestamp: new Date().toISOString(),
      total: logs.length,
      logs,
    },
  };
}

async function verifyChain(entryId) {
  const entry = await AuditLog.findById(entryId).lean();
  if (!entry) return { valid: false, error: 'Entry not found' };

  const computedHash = computeEntryHash(entry);
  if (computedHash !== entry.entryHash) {
    return { valid: false, error: 'Entry hash mismatch — data has been tampered with' };
  }

  if (entry.prevEntryHash) {
    const prevEntry = await AuditLog.findOne({ entryHash: entry.prevEntryHash }).lean();
    if (!prevEntry) {
      return { valid: false, error: `Previous entry with hash ${entry.prevEntryHash} not found — chain broken` };
    }
    const prevComputed = computeEntryHash(prevEntry);
    if (prevComputed !== prevEntry.entryHash) {
      return { valid: false, error: 'Previous entry hash mismatch — chain corrupted' };
    }
  }

  return { valid: true, chainLength: await AuditLog.countDocuments({}) };
}

module.exports = { ingestAuditLog, queryAuditLogs, getStats, verifyChainByWorkspace, exportLogs, verifyChain };
