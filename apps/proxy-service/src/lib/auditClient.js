const axios = require('axios');
const { AuditLog } = require('@vaultify/db');
const { env } = require('../config/env');

const STATE = { healthy: true, failCount: 0, lastFailTime: 0 };
const THRESHOLD = 3;
const COOLDOWN_MS = 30_000;

async function sendAuditLog(entry) {
  const now = Date.now();

  if (!STATE.healthy && now - STATE.lastFailTime < COOLDOWN_MS) {
    return fallbackWrite(entry);
  }

  if (!STATE.healthy && now - STATE.lastFailTime >= COOLDOWN_MS) {
    STATE.healthy = true;
    STATE.failCount = 0;
  }

  try {
    await axios.post(`${env.AUDIT_SERVICE_URL}/internal/audit/log`, entry, { timeout: 5000 });
    STATE.failCount = 0;
  } catch (err) {
    STATE.failCount++;
    STATE.lastFailTime = now;
    if (STATE.failCount >= THRESHOLD) {
      STATE.healthy = false;
      console.error('[AuditCircuit] Audit service unhealthy — falling back to MongoDB');
    }
    return fallbackWrite(entry);
  }
}

async function fallbackWrite(entry) {
  try {
    await AuditLog.create({
      ...entry,
      timestamp: new Date(),
      prevEntryHash: null,
      entryHash: null,
    });
  } catch (err) {
    console.error('[AuditCircuit] Fallback write failed:', err.message);
  }
}

module.exports = { sendAuditLog };
