# Vaultify — Security Fix Plan

## Overview

32 security problems identified — 17 original vulnerabilities, 6 new loopholes, 5 logic gaps, 4 weak fixes.

**Strategy**: 3 phases, ordered by dependency chain. Phase 1 is foundational (crypto + architecture), Phase 2 is auth/session, Phase 3 is operational.

---

## Phase 1 — Critical Cryptographic & Architecture Fixes

### 1.1 Envelope Encryption (V1, V8, V9, G2, W3)

**Problems**: Single `ENCRYPTION_KEY` for all vault secrets; one leak decrypts every customer. No DEK-per-key. AES-256-GCM nonce reuse risk at scale. "Use HashiCorp Vault" fix is circular (Vault also needs an unseal key).

**Fix**: Envelope encryption — per-key Data Encryption Keys wrapped by the master KEK.

- On `storeKey()`: generate a random 32-byte DEK via `crypto.randomBytes`, encrypt the API key with it, then wrap the DEK with `ENCRYPTION_KEY`. Store `{ wrappedDek, iv, authTag, ciphertext }` in MongoDB.
- On `getDecryptedKey()`: unwrap DEK with master key, decrypt API key with DEK.
- Use `crypto.hkdfSync` to derive per-encryption nonces from (DEK, incrementing counter) — eliminates nonce collision.
- No external dependencies. Pure Node.js `crypto` module.

**Files**: `packages/crypto/encrypt.js`, `packages/crypto/decrypt.js`, `apps/server/src/services/encryption.service.js`, `apps/server/src/modules/vault/vault.service.js`, `packages/db/schemas/key.schema.js`

---

### 1.2 Secure In-Memory Key Handling (V2, W1)

**Problems**: `buf.fill(0)` doesn't reach V8 GC-promoted copies — keys survive in heap. 60-second cache window is excessive for audit.

**Fix**: Replace plain `Map` cache with `SecureKeyHolder`:

- Hold decrypted keys as `Buffer` (not JS strings)
- After TTL expiry: `buf.fill(0)` + overwrite with random bytes before release
- After each proxy request: zero the Buffer immediately after use (don't hold across streaming)
- Reduce default TTL from 60s → 5s
- Hook into `process.on('exit')` and `process.on('SIGINT')` to zero all cached keys

**Files**: `apps/server/src/services/cache.service.js`, `apps/server/src/modules/proxy/proxy.middleware.js`, `apps/server/src/modules/vault/vault.service.js`

---

### 1.3 Service Split — Proxy + Audit into Separate Processes (V3, G3, G5)

**Problems**: Monolithic vault server. No isolation between proxy (externally facing) and key management. Audit log is mutable on same server.

**Fix**: Split into 3 deployable units:

1. **`apps/proxy-service/`** — proxy routes only (`/proxy/:provider/*`). Token validation, key decryption via admin-service API, request forwarding. No admin auth. No key management.
2. **`apps/admin-service/`** — key management, token CRUD, workspace, access requests. Requires JWT + MFA. Retains full admin surface.
3. **`apps/audit-service/`** — append-only audit log writer + reader. Separate port. Hash-chain integrity verification.

**Communication**: Admin-service exposes gRPC or internal REST for `decryptKey(keyId)` — proxy-service never touches DB directly. Audit-service has its own MongoDB connection with read-only user for queries.

**Re-delegation**: Audit is now append-only because audit-service runs independently — a compromised vault server can't stop audit emission (G3 resolved).

**Files**: `apps/proxy-service/` (new), `apps/admin-service/` (new), `apps/audit-service/` (new), updated `package.json` workspaces, `infra/docker/docker-compose.yml`

---

### 1.4 Request Body Inspection + Structured Logging (V5, W4)

**Problems**: Full prompt injection passthrough with no logging. SHA-256 body hash is forensically useless.

**Fix**:

- `requestBodyInspector` middleware captures request body (up to 4KB) as structured field
- Logs: body snippet, content-type, size, detected injection patterns
- For known providers: extract `messages[].content` for prompt tracking
- Replace hash-only logging with structured body data
- Configurable capture limit (default 4KB)

**Files**: `apps/proxy-service/src/middleware/bodyInspector.js`, `packages/db/schemas/audit.schema.js`, `apps/server/src/modules/proxy/proxy.middleware.js`

---

### 1.5 Tenant Isolation at Database Layer (L3)

**Problems**: NoSQL injection or query bug could expose one customer's encrypted blobs to another.

**Fix**: Global Mongoose plugin that enforces workspace scoping:

- Every query across all models must include `workspaceId`
- Mongoose `pre('find')` hook prepends `workspaceId` from `req.user`
- Schema-level compound indexes on `workspaceId + ...` for all collections
- Unit tests verifying cross-tenant queries return empty

**Files**: `packages/db/plugins/workspaceScoped.js` (new), `packages/db/index.js`, all schema files

---

### 1.6 Streaming Response Security (L5)

**Problems**: API key held in memory for up to 120 seconds during streaming. No response header stripping.

**Fix**:

- Zero the real key Buffer immediately after establishing the upstream connection (before streaming back)
- `responseSanitizer` middleware: whitelist-only header forwarding; strip `Set-Cookie`, `X-Amz-*`, `X-Azure-*`, trace headers
- Chunk-level rate accounting for pay-per-token providers
- Max stream timeout: 60s streaming, 30s non-streaming

**Files**: `apps/proxy-service/src/middleware/responseSanitizer.js`, `apps/server/src/modules/proxy/proxy.middleware.js`

---

## Phase 2 — Session, Auth & Rate Limiting Fixes

### 2.1 JWT Binding + Server-Side DPoP (V6, W2, G1)

**Problems**: JWT has no token binding — stealing the token gives full dashboard access for 1 hour. DPoP was client-side only (no server-side jti replay detection).

**Fix**:

- `jti` (JWT ID) per token — server stores used jti in Redis with TTL matching token expiry
- Token binding: JWT includes `ip_hash` + `ua_hash` claims. Reject if IP or UA changed.
- Refresh token rotation with token family tracking
- Server-side jti replay detection is what makes DPoP actually secure

**Files**: `packages/auth/jwt.js`, `packages/auth/middleware.js`, `apps/server/src/modules/auth/auth.controller.js`

---

### 2.2 CLI Session Token Security (V7, G1)

**Problems**: CLI stores JWT in `~/.vaultify/config.json` as plaintext on disk.

**Fix**:

- OS-level secret storage:
  - Windows: `wincred` (PowerShell `SecretManagement` / `Microsoft.PowerShell.SecretManagement`)
  - macOS: Keychain via `security` CLI
  - Linux: `secret-tool` (libsecret)
- `vaultify logout` clears stored token
- Document the security model

**Files**: `apps/cli/src/services/api.js`, `apps/cli/src/commands/login.js`, `apps/cli/src/commands/logout.js`

---

### 2.3 Vercel Token Scoping (L4)

**Problems**: VERCEL_API_TOKEN is a persistent backdoor to every customer's deployment env.

**Fix**:

- Move Vercel operations to dedicated `integration-service`
- OAuth-based Vercel integration (per-customer tokens, not shared platform token)
- Token scope limited to `env:read+write` on specific projects
- Fall back to customer-provided tokens for self-hosted

**Files**: `apps/server/src/lib/vercel.js`, new OAuth flow for Vercel marketplace

---

### 2.4 Multi-Layer Rate Limiting (V10, G4)

**Problems**: Rate limiting is IP-based only. Per-token daily limits don't catch slow-burn abuse.

**Fix**: 4 layers + slow-burn detection:

1. IP-based: 100/min per IP (exists)
2. Token-based: daily limit via rolling window (exists)
3. User-based: 1000/min per user (new)
4. Workspace-based: 10000/min per workspace (new)
5. Slow-burn: alert if token sustains >50% daily limit for >6 consecutive hours (new)

**Files**: `apps/server/src/middleware/rateLimiter.js`, `apps/server/src/services/anomaly.service.js`, `packages/utils/rateLimiter.js`

---

### 2.5 Append-Only Audit Log (V11, G3)

**Problems**: Audit log stored in mutable MongoDB collection — useless after breach. No hash chain integrity.

**Fix**:

- Append-only semantics: application layer prevents `deleteOne`/`deleteMany` on AuditLog
- Hash chain: each entry includes `prevEntryHash` (SHA-256 of previous entry's serialized fields)
- Merkle tree roots stored in separate `AuditAnchor` collection (insert-only, no deletes)
- `GET /api/audit/verify/:id` validates chain integrity from genesis to entry
- Audit-service owns the log writer; admin-service can only read

**Files**: `packages/db/schemas/audit.schema.js`, `apps/audit-service/`, `packages/logger/logger.js`

---

### 2.6 SDK Security Hardening (L1)

**Problems**: npm package can leak tokens via error logs, Sentry, Datadog. No CSP guidance.

**Fix**:

- `redactToken` option: redacts `vlt_` token from all error output
- `sentrySafe` mode: sanitized error objects
- CSP documentation for proxy server
- `tokenExpirationCheck()`: warns if token is near expiry
- Client-side `429` handling with exponential backoff

**Files**: `packages/vaultify/lib/client.js`, `packages/vaultify/lib/errors.js`

---

## Phase 3 — Operational, Anomaly Detection & Remaining Fixes

### 3.1 Adaptive Anomaly Detection (V12)

**Problems**: Static thresholds (10 errors, 80% limit, 5x avg) cause massive false positives.

**Fix**:

- Exponential moving average baselines per-token and per-workspace
- 3σ alerting above rolling baseline instead of fixed multipliers
- 24 hourly time-of-day buckets instead of UTC hour range
- 7-day learning period (no alerts, baseline building only)
- Anomaly scores stored in audit log

**Files**: `apps/server/src/services/anomaly.service.js`

---

### 3.2 Access Request CSRF Protection (V13)

**Problems**: Email link approval is a CSRF vector — no re-authentication required.

**Fix**:

- Re-authentication (password or MFA TOTP) before approve/deny
- CSRF token on approve/deny forms (server-generated, one-time)
- Email links include signed JWT scoped to the request (15-minute expiry)
- All approval attempts logged immutably

**Files**: `apps/admin-service/src/modules/access/request.controller.js`, `apps/admin-service/src/modules/access/request.service.js`

---

### 3.3 Secure `.env` Parsing (V14)

**Problems**: `vaultify push` reads entire `.env` file — supply chain attack on `dotenv` could exfiltrate everything.

**Fix**:

- Replacement strict token-only parser
- Only extract lines matching `^[A-Z_]+=vlt_` — ignore everything else
- `--strict` mode: fail if any non-token variable present
- File integrity SHA-256 check before parsing

**Files**: `apps/cli/src/services/envParser.js`, `apps/cli/src/commands/sync.js`

---

### 3.4 Mutual TLS for Provider Connections (V15)

**Problems**: No mTLS to upstream providers — MITM can capture injected plaintext keys.

**Fix**:

- Optional mTLS support via `https.Agent` with `ca`, `cert`, `key`
- Per-provider CA certificate config in constants
- `STRICT_TLS` env var: reject providers without mTLS when set

**Files**: `apps/server/src/lib/axios.js`, `apps/server/src/config/constants.js`

---

### 3.5 Dynamic Provider Registry (V16)

**Problems**: Hardcoded provider list breaks every time a provider changes their API.

**Fix**:

- `ProviderConfig` collection in MongoDB — dynamic provider URLs + auth headers
- Admin CRUD for providers
- Redis cache with 1-hour TTL
- Fallback to hardcoded defaults if DB unreachable
- `provider-override` header for custom URLs

**Files**: `packages/db/schemas/provider.schema.js` (new), `apps/admin-service/src/modules/providers/` (new)

---

### 3.6 Defined Secret Zero / Bootstrap (V17)

**Problems**: No defined secret zero — bootstrap process is ad-hoc and undocumented.

**Fix**:

- `docs/BOOTSTRAP.md`: ENCRYPTION_KEY generation, JWT_SECRET generation, key ceremony, disaster recovery
- `POST /api/admin/bootstrap` endpoint (callable once)
- `docs/ROTATION.md`: secret rotation playbook

**Files**: `docs/BOOTSTRAP.md` (new), `docs/ROTATION.md` (new)

---

### 3.7 Secure Secret Export (L2)

**Problems**: No way for customers to export original API keys (GDPR data portability issue).

**Fix**:

- `POST /api/vault/keys/:id/export` — returns key encrypted with customer-provided GPG public key
- Requires MFA re-authentication
- Rate-limited: 1 per 24 hours per key
- Immutably audited

**Files**: `apps/admin-service/src/modules/vault/vault.controller.js`

---

### 3.8 Incident Response Plan (L6)

**Problems**: No mass revocation, breach notification timeline, upstream provider notification, VDP.

**Fix**:

- `docs/INCIDENT_RESPONSE.md`: mass revocation endpoint, notification timeline, provider templates, VDP, post-mortem template
- `POST /api/admin/emergency/revoke-all` — revokes every token in a workspace
- `GET /api/admin/emergency/status` — breach assessment dashboard

**Files**: `docs/INCIDENT_RESPONSE.md` (new), `apps/admin-service/src/modules/emergency/` (new)

---

### 3.9 Combined Attack Chain Verification (G1)

**Problems**: V4 + V6 + V7 attack chain — steal CLI session → get dashboard JWT → create new proxy token.

**Fix**: Already covered by Phase 2 fixes — no additional work. Verification test:
- Test: stolen JWT used from different IP → rejected by binding check
- Test: stolen CLI config file → token not extractable (OS-level storage)
- Test: Vercel env var leaked → `vlt_` token is worthless without proxy service access

---

## Implementation Order Within Each Phase

**Phase 1**: 1.5 (tenant isolation) → 1.1 (envelope encryption) → 1.2 (secure memory) → 1.3 (service split) → 1.6 (streaming) → 1.4 (body inspection)

**Phase 2**: 2.1 (JWT binding) → 2.2 (CLI secrets) → 2.5 (immutable audit) → 2.4 (rate limiting) → 2.3 (Vercel scoping) → 2.6 (SDK hardening)

**Phase 3**: 3.6 (bootstrap doc) + 3.8 (IR doc) → 3.1 (adaptive anomaly) → 3.2 (CSRF fix) → 3.3 (env parsing) → 3.5 (provider registry) → 3.4 (mTLS) → 3.7 (export) → 3.9 (chain test)

---

## Vulnerability Map

| ID | Problem | Phase | Fix |
|----|---------|-------|-----|
| V1 | Single encryption key for all secrets | 1.1 | Per-key DEKs with envelope encryption |
| V2 | 60s in-memory cache, heap dump exposure | 1.2 | SecureKeyHolder, 5s TTL, Buffer zeroing |
| V3 | Monolithic SPOF | 1.3 | Split proxy + audit + admin services |
| V4 | Proxy token in Vercel env vars | 2.3 | OAuth-based per-customer Vercel tokens |
| V5 | No request body inspection | 1.4 | Body inspector middleware |
| V6 | JWT no binding | 2.1 | jti replay + ip/ua binding |
| V7 | CLI plaintext token storage | 2.2 | OS-level secret storage |
| V8 | MongoDB as secret store | 1.1 | Envelope encryption (replaces) |
| V9 | AES-256-GCM nonce reuse | 1.1 | HKDF-derived per-encryption nonces |
| V10 | IP-only rate limiting | 2.4 | Multi-layer + slow-burn detection |
| V11 | Mutable audit log | 2.5 | Hash chain + append-only + service split |
| V12 | Static anomaly thresholds | 3.1 | Adaptive EMA baselines |
| V13 | CSRF in access request approval | 3.2 | Re-auth + signed request tokens |
| V14 | vaultify push reads entire .env | 3.3 | Strict token-only parser |
| V15 | No mTLS to providers | 3.4 | Optional mTLS via https.Agent |
| V16 | Hardcoded provider list | 3.5 | Dynamic ProviderConfig collection |
| V17 | No defined secret zero | 3.6 | Bootstrap doc + endpoint |
| L1 | No SDK security model | 2.6 | RedactToken + CSP docs + backoff |
| L2 | No secure export path | 3.7 | GPG-encrypted export endpoint |
| L3 | No tenant isolation in DB | 1.5 | Workspace-scoped Mongoose plugin |
| L4 | Vercel token backdoor | 2.3 | OAuth per-customer scoping |
| L5 | Streaming response issues | 1.6 | Early key zeroing + header sanitizer |
| L6 | No incident response plan | 3.8 | IR doc + mass revocation endpoint |
| G1 | V4+V6+V7 attack chain | 2.1+2.2 | Combined DPoP + OS secrets |
| G2 | V1 doesn't solve V9 | 1.1 | HKDF nonces resolve it |
| G3 | V11 useless without V3 | 1.3+2.5 | Service split makes audit append-only |
| G4 | V10 misses slow-burn | 2.4 | Slow-burn detection added |
| G5 | V14 firewall vs proxy egress | 1.3 | Split resolves the conflict |
| W1 | V2 buffer zeroing defeated by GC | 1.2 | ManagedBuffer with overwrite |
| W2 | V6 DPoP client-side only | 2.1 | Server-side jti replay detection |
| W3 | V8 HashiCorp recursion | 1.1 | Envelope encryption, no Vault needed |
| W4 | V5 SHA-256 hash useless | 1.4 | Structured body logging |
