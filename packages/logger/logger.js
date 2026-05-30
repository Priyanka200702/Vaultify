const crypto = require('crypto');

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

async function getLastEntryHash(AuditLog) {
  try {
    const lastEntry = await AuditLog.findOne({}, { entryHash: 1 })
      .sort({ timestamp: -1 })
      .lean();
    return lastEntry?.entryHash || null;
  } catch (err) {
    return null;
  }
}

async function logRequest(AuditLog, entry) {
  try {
    const prevEntryHash = await getLastEntryHash(AuditLog);
    const doc = {
      ...entry,
      prevEntryHash,
      entryHash: null,
      timestamp: new Date(),
    };
    doc.entryHash = computeEntryHash(doc);
    await AuditLog.create(doc);
  } catch (err) {
    console.error('[AUDIT] Failed to log request:', err.message);
  }
}

async function getRecentLogs(AuditLog, workspaceId, options = {}) {
  const { page = 1, limit = 20, environment, tokenId } = options;

  const filter = { workspaceId };
  if (environment) filter.environment = environment;
  if (tokenId) filter.tokenId = tokenId;

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return { logs, total, page, totalPages: Math.ceil(total / limit) };
}

module.exports = { logRequest, getRecentLogs, computeEntryHash };
