# Vaultify Incident Response Plan

## 1. Incident Severity Levels

| Level | Label | Example | Response Time |
|-------|-------|---------|---------------|
| SEV-1 | Critical | Active key compromise, data breach | < 15 min |
| SEV-2 | High | Token leak, service degradation | < 1 hour |
| SEV-3 | Medium | Suspicious activity, single-token anomaly | < 4 hours |
| SEV-4 | Low | Audit chain corruption detected | < 24 hours |

## 2. Detection Sources

- **Rate limiter** – 429 responses trigger a review if sustained
- **Slow-burn detector** – gradual increase in traffic patterns (X-Slow-Burn header set)
- **Anomaly detector** – MAD score > 3.5 triggers token lockout and console alert
- **Body inspector** – prompt injection pattern matches logged with injectionPatterns field
- **Audit hash chain** – verify endpoint detects chain breaks
- **JTI replay** – duplicate jti detection in jtiStore
- **Token binding** – mismatched IP/UA hash on JWT verification

## 3. Response Procedures

### 3.1 SEV-1: Key or Token Compromise

1. **Isolate** — Identify the compromised token/key via audit log (tokenId, sourceIp, memberId)
2. **Revoke** — Immediately revoke the affected token(s):
   ```bash
   vaultify tokens revoke <tokenId>
   ```
3. **Rotate** — Rotate the underlying vault key (creates new encryption, re-wraps DEK):
   ```bash
   curl -X POST /api/vault/rotate/<keyId> -H "Authorization: Bearer <admin-jwt>"
   ```
4. **Audit** — Review audit logs for unauthorized access:
   ```bash
   curl /api/audit/export?tokenId=<compromised>&format=json
   ```
5. **Notify** — If customer data was exposed, notify affected customers within 72 hours (GDPR)
6. **Post-mortem** — Document root cause and update controls

### 3.2 SEV-1: Active DDoS / Rapid Traffic Spike

1. **Isolate** — Check slow-burn detector output; identify affected workspace
2. **Throttle** — Apply workspace-level rate limiting (lower `max` for that workspace)
3. **Block** — If specific source IPs identified:
   ```bash
   vaultify tokens update <tokenId> --allowed-ips <trusted-cidr>
   ```
4. **Escalate** — If across workspaces, apply global rate limit reduction
5. **Recover** — After event subsides, restore original rate limits

### 3.3 SEV-2: Audit Chain Integrity Alert

1. **Verify** — Run the integrity check:
   ```bash
   curl /api/audit/verify
   ```
2. **Isolate** — Identify the first corrupted entry (prevEntryHash mismatch)
3. **Quarantine** — Copy the affected batch to a separate collection for forensic analysis
4. **Restore** — If corruption is isolated, restore from backup; if widespread, initiate SEV-1
5. **Root cause** — Determine if corruption was DB-level (MongoDB integrity) or application-level (bypass of audit service)

### 3.4 SEV-3: Token Locked by Anomaly Detector

1. **Review** — Check the anomaly log for the token:
   ```
   [ANOMALY] token=<id> score=<value> strike=<n>
   ```
2. **Analyze** — High MAD latency scores suggest key rotation at provider; high request size variance may indicate data exfiltration
3. **Release** — If false positive, clear the lockout:
   ```bash
   vaultify tokens unlock <tokenId>
   ```
4. **Tune** — Adjust MAD_THRESHOLD in anomalyDetector.service.js if needed

## 4. Communication Channels

| Channel | Purpose | Access |
|---------|---------|--------|
| Console stderr | Automated anomaly alerts | Server admins |
| Audit log | All requests logged with hash chain | Workspace owners |
| Slack webhook | Configured via SLACK_WEBHOOK_URL | Ops team |
| Email (Resend) | Access request notifications | Requester + workspace owner |

## 5. Post-Incident Recovery

1. **Rotate secrets** if any key/token was exposed:
   - Rotate vault key → re-wrap all proxy tokens
   - Update ENCRYPTION_KEY in .env → re-encrypt all vault keys
   - Update JWT_SECRET → invalidate all active sessions
2. **Clear token lockouts** after anomaly review:
   ```javascript
   // In Node.js REPL: require the anomaly detector and call clearToken(id)
   ```
3. **Restore audit integrity** from backup if chain was corrupted
4. **Update runbook** with lessons learned

## 6. Escalation Matrix

| Role | Contact | Response |
|------|---------|----------|
| On-call engineer | pagerduty / slack | SEV-1: immediate |
| Security engineer | security@vaultify.dev | SEV-1: within 15 min |
| Engineering lead | eng-lead@vaultify.dev | SEV-1/2: within 1 hour |
| CTO | cto@vaultify.dev | SEV-1: notify immediately |
| Legal | legal@vaultify.dev | Data breach: notify within 24 hours |

## 7. Testing Schedule

- **Monthly** — Trigger anomaly detector with synthetic tests
- **Quarterly** — Full IR tabletop exercise covering SEV-1 scenarios
- **Per release** — Verify audit hash chain integrity after DB migrations
