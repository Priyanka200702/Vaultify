const { AuditLog } = require('@vaultify/db');
const { sendSlackNotification } = require('./notification.service');

/**
 * Checks for anomaly patterns and sends alerts.
 * Called asynchronously after proxy request.
 */
async function checkAnomalies(tokenId, memberId, sourceIp, endpoint, statusCode) {
  try {
    const token = await require('@vaultify/db').ProxyToken.findById(tokenId);
    if (!token) return;

    // Alert 1: 10+ consecutive 4xx/5xx responses
    await checkConsecutiveErrors(tokenId, memberId, statusCode);

    // Alert 2: Token exceeds 80% of daily rate limit
    await checkRateLimitSpike(tokenId, token.rateLimitDaily);

    // Alert 3: Sudden spike (5x above 7-day average)
    await checkUsageSpike(tokenId);

    // Alert 4: Called outside historical usage hours (basic check)
    await checkOffHoursUsage(tokenId);

    // Alert 5: New geographic region (simplified - just track IPs)
    await checkNewIpLocation(tokenId, memberId, sourceIp);

  } catch (err) {
    console.error('[Anomaly] Check failed:', err.message);
  }
}

/**
 * Alert: 10+ consecutive 4xx/5xx responses.
 */
async function checkConsecutiveErrors(tokenId, memberId, currentStatus) {
  if (currentStatus < 400) return; // Not an error

  const recentLogs = await AuditLog.find({
    tokenId,
    memberId,
  })
    .sort({ timestamp: -1 })
    .limit(10)
    .lean();

  if (recentLogs.length < 10) return;

  const allErrors = recentLogs.every((log) => log.statusCode >= 400);
  if (allErrors) {
    await sendSlackNotification(
      `🚨 *Anomaly Detected: Consecutive Errors*\n• Token: ${tokenId}\n• 10+ consecutive 4xx/5xx responses\n• Latest: ${currentStatus}`
    );
  }
}

/**
 * Alert: Token exceeds 80% of daily rate limit within a single hour.
 */
async function checkRateLimitSpike(tokenId, rateLimitDaily) {
  if (!rateLimitDaily) return;

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const count = await AuditLog.countDocuments({
    tokenId,
    timestamp: { $gte: oneHourAgo },
  });

  if (count >= rateLimitDaily * 0.8) {
    await sendSlackNotification(
      `🚨 *Anomaly Detected: Rate Limit Spike*\n• Token: ${tokenId}\n• ${count} calls in last hour (80%+ of daily limit: ${rateLimitDaily})`
    );
  }
}

/**
 * Alert: Sudden spike (5x above 7-day average).
 */
async function checkUsageSpike(tokenId) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const sevenDayCount = await AuditLog.countDocuments({
    tokenId,
    timestamp: { $gte: sevenDaysAgo },
  });

  const yesterdayCount = await AuditLog.countDocuments({
    tokenId,
    timestamp: { $gte: yesterday },
  });

  const sevenDayAvg = sevenDayCount / 7;
  if (sevenDayAvg > 0 && yesterdayCount >= sevenDayAvg * 5) {
    await sendSlackNotification(
      `🚨 *Anomaly Detected: Usage Spike*\n• Token: ${tokenId}\n• Yesterday: ${yesterdayCount} calls\n• 7-day avg: ${sevenDayAvg.toFixed(1)} calls/day\n• Spike: ${((yesterdayCount / sevenDayAvg).toFixed(1))}x above average`
    );
  }
}

/**
 * Alert: Called outside historical usage hours (9am-6pm is typical).
 */
async function checkOffHoursUsage(tokenId) {
  const hour = new Date().getUTCHours();
  if (hour >= 9 && hour <= 18) return; // Within typical hours

  const recentLogs = await AuditLog.find({
    tokenId,
    timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  })
    .lean();

  if (recentLogs.length === 0) return;

  const offHoursLogs = recentLogs.filter((log) => {
    const logHour = new Date(log.timestamp).getUTCHours();
    return logHour < 9 || logHour > 18;
  });

  const offHoursRatio = offHoursLogs.length / recentLogs.length;
  if (offHoursRatio < 0.1) {
    // Less than 10% of calls are off-hours historically
    await sendSlackNotification(
      `🚨 *Anomaly Detected: Off-Hours Usage*\n• Token: ${tokenId}\n• Called at ${hour}:00 UTC\n• Historically <10% of calls are off-hours`
    );
  }
}

/**
 * Alert: New IP address (simplified geographic check).
 */
async function checkNewIpLocation(tokenId, memberId, sourceIp) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const existingLogs = await AuditLog.find({
    tokenId,
    memberId,
    timestamp: { $gte: thirtyDaysAgo },
    sourceIp: { $ne: sourceIp },
  })
    .limit(1)
    .lean();

  if (existingLogs.length === 0) {
    // This is normal — no previous IPs recorded
    return;
  }

  // Check if this IP has been seen before
  const seenBefore = await AuditLog.findOne({
    tokenId,
    sourceIp,
    timestamp: { $gte: thirtyDaysAgo },
  });

  if (!seenBefore) {
    await sendSlackNotification(
      `🚨 *Anomaly Detected: New IP Location*\n• Token: ${tokenId}\n• New IP: ${sourceIp}\n• Not seen in past 30 days`
    );
  }
}

module.exports = { checkAnomalies };
