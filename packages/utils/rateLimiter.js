/**
 * Counts requests in a rolling time window for a given token.
 * Used to enforce daily rate limits on proxy tokens.
 *
 * This queries the AuditLog collection — the model must be passed in
 * to avoid circular dependency with packages/db.
 *
 * @param {import('mongoose').Model} AuditLog - The Mongoose AuditLog model.
 * @param {string} tokenId - The proxy token ID.
 * @param {number} windowHours - Rolling window in hours (default 24).
 * @returns {Promise<number>} The number of requests in the window.
 */
async function rollingWindowCount(AuditLog, tokenId, windowHours = 24) {
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const count = await AuditLog.countDocuments({
    tokenId,
    timestamp: { $gte: windowStart },
  });

  return count;
}

module.exports = { rollingWindowCount };
