/**
 * Audit logger — writes and queries per-request log entries.
 * The AuditLog model is passed in to avoid circular dependency.
 */

/**
 * Logs a proxied request to the audit collection (async, non-blocking).
 *
 * @param {import('mongoose').Model} AuditLog - The Mongoose AuditLog model.
 * @param {Object} entry - The audit log entry fields.
 * @param {string} entry.tokenId - ProxyToken ObjectId.
 * @param {string} entry.tokenString - The vlt_ token string.
 * @param {string} entry.workspaceId - Workspace ObjectId.
 * @param {string} [entry.memberId] - User ObjectId (if known).
 * @param {string} [entry.memberName] - User display name.
 * @param {string} entry.sourceIp - Caller's IP address.
 * @param {string} [entry.geoLocation] - Geo string (e.g. "US, California").
 * @param {string} entry.endpoint - "METHOD /path" (e.g. "POST /v1/messages").
 * @param {string} entry.provider - Provider name (e.g. "anthropic").
 * @param {number} entry.statusCode - HTTP response status.
 * @param {number} entry.latencyMs - Request latency in ms.
 * @param {number} [entry.requestSize] - Request body size in bytes.
 * @param {number} [entry.responseSize] - Response body size in bytes.
 * @param {string} entry.environment - "production" | "preview" | "development".
 * @returns {Promise<void>}
 */
async function logRequest(AuditLog, entry) {
  try {
    await AuditLog.create({
      ...entry,
      timestamp: new Date(),
    });
  } catch (err) {
    // Audit logging should never crash the proxy — fail silently
    console.error('[AUDIT] Failed to log request:', err.message);
  }
}

/**
 * Retrieves recent audit log entries for a workspace.
 *
 * @param {import('mongoose').Model} AuditLog - The Mongoose AuditLog model.
 * @param {string} workspaceId - Workspace ObjectId.
 * @param {Object} [options]
 * @param {number} [options.page=1] - Page number.
 * @param {number} [options.limit=20] - Entries per page.
 * @param {string} [options.environment] - Filter by environment.
 * @param {string} [options.tokenId] - Filter by specific token.
 * @returns {Promise<{ logs: Object[], total: number, page: number, totalPages: number }>}
 */
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

  return {
    logs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

module.exports = { logRequest, getRecentLogs };
