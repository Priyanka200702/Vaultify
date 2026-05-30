# Bugs & Architectural Gaps

## Priority Legend
- **P0** — Crash-on-startup, security bypass with known exploit
- **P1** — Security gap, needs architectural fix
- **P2** — Should fix before production
- **P3** — Nice to have, iterative improvement

---

## P0 — Critical: Services Crash on Startup or Runtime

### P0.1 `connectDB()` missing import in proxy-service and audit-service
**Files:**
- `apps/proxy-service/src/server.js:5`
- `apps/audit-service/src/server.js:5`

**Bug:** Both files call `await connectDB(env.MONGO_URI)` but `connectDB` is never imported. Will throw `ReferenceError` at startup.

**Fix:** Add `const { connectDB } = require('@vaultify/db');` to both files.

### P0.2 No `process.on('uncaughtException')` or `process.on('unhandledRejection')` in any service
**Files:** All 3 `server.js` files.

**Bug:** Any unexpected async throw crashes the process with no cleanup. Node >=15 terminates on unhandled rejections.

**Fix:** Add both handlers to every `server.js` — log full stack, attempt graceful shutdown, `process.exit(1)`.

### P0.3 No `mongoose.connection.on('error')` listeners in any service
**Files:** All 3 `server.js` files and `packages/db/index.js`.

**Bug:** If MongoDB disconnects after startup, the next database query throws an unhandled error. No reconnection logic or error logging.

**Fix:** Add `mongoose.connection.on('error')` and `mongoose.connection.on('disconnected')` handlers in each `server.js`.

---

## P0 — Critical: Proxy Middleware Bypasses Express Error Handler

### P0.4 `proxyMiddleware` function signature omits `next` parameter
**Files:**
- `apps/proxy-service/src/modules/proxy/proxy.middleware.js:26` — signature: `proxyMiddleware(req, res)`
- `apps/server/src/modules/proxy/proxy.middleware.js:49` — signature: `proxyMiddleware(req, res)`

**Bug:** Express error middleware is identified by its 4-parameter arity `(err, req, res, next)`. A middleware with only `(req, res)` cannot call `next(err)`. Errors inside these handlers never reach the global error handler — they become unhandled promise rejections.

**Fix:** Add `next` as third parameter, wrap the entire function body in `try { ... } catch (err) { next(err) }`.

### P0.5 Fire-and-forget audit logging has no `.catch()` in proxy-service
**File:** `apps/proxy-service/src/modules/proxy/proxy.middleware.js:100-113`

**Bug:** `setImmediate(() => sendAuditLog(...))` — the returned promise is never caught. If the circuit breaker + MongoDB fallback both fail, this is an unhandled rejection.

**Fix:** Add `.catch((err) => console.error('[Proxy] Audit log failed:', err))`.

### P0.6 `token.service.js` has no try-catch around database operations
**File:** `apps/proxy-service/src/modules/tokens/token.service.js:10,46`

**Bug:** `await ProxyToken.findOne({ tokenString })` and `await rollingWindowCount(...)` have zero error handling. If MongoDB is down, these throw unhandled.

**Fix:** Wrap the entire `validateToken` function body in try-catch, return `{ valid: false, code: 'VALIDATION_INTERNAL_ERROR' }` on failure.

---

## P1 — Zero Trust Architecture Gaps

### P1.1 Standalone proxy-service has no anomaly detection at all
**File:** Entire `apps/proxy-service/` directory.

**Bug:** The admin-service (`apps/server/`) has full anomaly detection (MAD scoring, escalating lockout, synchronous lockout check). The standalone proxy-service (used when `PROXY_SERVICE_ENABLED=true`) has zero — no lockout check, no anomaly scoring, no wrapAnomalyCheck. Long-running abusive tokens are never detected.

**Fix:** Extract `AnomalyDetector` from `apps/server/src/services/anomalyDetector.service.js` into a shared `@vaultify/anomaly` package. Import and wire into proxy-service's proxy middleware.

### P1.2 Anomaly scoring is async (fire-and-forget), not a pre-flight gate
**File:** `apps/server/src/middleware/anomaly.middleware.js:7`

**Bug:** `wrapAnomalyCheck` runs all logic inside `setImmediate(async () => {...})` — the response is already committed before scoring runs. The lockout check IS synchronous (`lockoutCheck` at `proxy.middleware.js:85`), but lockout state is only updated after the anomalous request goes through. The first anomalous request always succeeds.

**Fix:** Add a synchronous `checkAnomaly(tokenId, features)` function that returns `{ flagged: boolean, score: number }` and runs before key decryption. Keep `wrapAnomalyCheck` for async recording, but add the pre-flight gate as the Zero Trust checkpoint.

### P1.3 Anomaly detection state is in-memory only (lost on restart)
**File:** `apps/server/src/services/anomalyDetector.service.js:11-12`

**Bug:** `this.baselines = new Map()` and `this.lockouts = new Map()` live in process memory. Server restart clears all lockout state. An attacker can wait for a restart to reset their lockout counter.

**Fix:** Add optional Redis backend for persistence. Keep in-memory as fallback.

### P1.4 Non-proxy scopes defined but never enforced on admin API routes
**File:** `packages/utils/scopes.js:15-27` defines `tokens:read`, `tokens:write`, `audit:read`, `workspace:read`, `workspace:write`. **Files:** All route files under `apps/server/src/modules/*/`.

**Bug:** The non-proxy scopes exist in the schema and scope registry. API routes use only `authMiddleware` (JWT) and `requireRole` — no route checks for `tokens:read`, `audit:read`, etc. Any authenticated user can call any admin API endpoint regardless of token scopes.

**Fix:** Create `requireScope(requiredScope)` middleware. Wire it into every admin route:
- `GET /api/tokens` → `requireScope('tokens:read')`
- `POST /api/tokens` → `requireScope('tokens:write')`
- `GET /api/audit` → `requireScope('audit:read')`
- etc.

---

## P1 — Insider Threat: KEK Lives on Application Server

### P1.5 `ENCRYPTION_KEY` environment variable stored in `.env` on the same server as MongoDB
**Files:**
- `apps/server/src/config/env.js:15` — `ENCRYPTION_KEY` loaded from `.env`
- `apps/server/src/services/encryption.service.js:10-11` — used directly as `unwrapDek(..., env.ENCRYPTION_KEY)`
- `packages/crypto/envelope.js:23-31` — `wrapDek` takes raw hex key

**Bug:** A developer with SSH access to the server AND MongoDB access can:
1. Read `ENCRYPTION_KEY` from `.env`
2. Read all `encryptedKey` documents from `VaultKeys` collection
3. Decrypt every customer's API keys offline
4. No audit log, no anomaly detection, no trace

This is structural. Our envelope encryption correctly separates per-key DEKs from the KEK, but the KEK itself (`ENCRYPTION_KEY`) is on the same server as the ciphertext. The lock and the key are in the same room.

**Fix (option A — KMS, recommended):** Add a `KekProvider` interface in `packages/crypto/`. Implement AWS KMS provider:
- `encryption.service.js` calls `kekProvider.wrap(dek)` / `kekProvider.unwrap(wrappedDek)` instead of raw AES-GCM
- KMS provider calls `KMS.encrypt(dek, keyId)` / `KMS.decrypt(ciphertext)` — the raw KEK never touches the application server
- Add `KEK_PROVIDER` env var (`local` | `aws-kms` | `gcp-kms`)
- No schema changes needed — `wrappedDek` payload shape is identical

**Fix (option B — user-held keys / zero knowledge):**
- User provides passphrase when creating a vault key
- KEK is derived from passphrase, never stored on server
- At proxy time, user sends KEK with the request
- Server decrypts in memory, forwards, discards
- Tradeoff: user must be online for every proxied request

**Fix (option C — separate keystore microservice):**
- Extract `encryption.service.js` + `vault.service.js` into standalone `keystore-service` (port 3004)
- Only keystore holds `ENCRYPTION_KEY` in memory
- Proxy and admin call internal API to decrypt
- Compromising proxy or admin doesn't yield the KEK

---

## P1 — SDK Compatibility: `vlt_` Prefix Rejected by Provider SDKs

### P1.6 `vlt_` token format is rejected by official SDKs
**Files:**
- `apps/proxy-service/src/modules/proxy/proxy.middleware.js:33-34` — accepts `Bearer vlt_...`
- `apps/server/src/modules/proxy/proxy.middleware.js:58-61` — same
- `packages/utils/providerRegistry.js` — lists all provider key prefixes
- `apps/proxy-service/src/modules/tokens/token.service.js:6` — `validateTokenFormat()` rejects non-`vlt_` tokens

**Bug:** A developer using the official OpenAI SDK does:
```js
const openai = new OpenAI({
  apiKey: 'vlt_abc123',       // ❌ SDK rejects — must start with 'sk-' or 'sk-proj-'
  baseURL: 'http://localhost:3001/proxy/openai/'
});
```
Same pattern for Anthropic (`sk-ant-`), Stripe (`sk_live_`/`sk_test_`), GitHub (`ghp_`/`github_pat_`), AWS (`AKIA`), etc. Each SDK validates its key format before any network call.

**Fix — Generate provider-prefixed vault tokens:**
| Provider | Vaultify key format | SDK validates? |
|---|---|---|
| OpenAI | `sk-vlt-<random64>` | ✅ `startsWith('sk-')` |
| Anthropic | `sk-ant-vlt-<random64>` | ✅ `startsWith('sk-ant-')` |
| Stripe | `sk_live_vlt_<random64>` | ✅ `startsWith('sk_live_')` |
| GitHub | `ghp_vlt_<random64>` | ✅ `startsWith('ghp_')` |
| AWS | `AKIAVLT<random16>` | ✅ 20-char uppercase |

Changes needed:
1. **`@vaultify/utils` — `validateTokenFormat()`**: Accept any registered Vaultify-prefixed format (not just `vlt_`)
2. **Token issuance** (`token.controller.js` or `token.service.js`): Accept a `provider` field, generate provider-matching prefix
3. **Token validation** (both proxy service and admin service): Extract the Vaultify portion from any provider prefix, route internally the same way
4. **Provider registry**: Add `vaultPrefix` to each provider entry mapping (or compose dynamically)

The developer's config becomes:
```js
const openai = new OpenAI({
  apiKey: 'sk-vlt-abc123',        // ✅ SDK accepts
  baseURL: 'http://localhost:3001/proxy/openai/'
});
```

### P1.7 `PROXY_SERVICE_ENABLED=false` by default
**File:** `apps/server/src/config/env.js:17`

**Bug:** Default value means admin and proxy run in a single Node.js process. The same memory heap holds `ENCRYPTION_KEY`, `JWT_SECRET`, decrypted API keys, MongoDB connection, and all route handlers. Any vulnerability in one component compromises everything.

**Fix:** Flip default to `true`. After the standalone proxy-service has anomaly detection (P1.1), remove admin proxy routes entirely.

---

## P2 — Should Fix Before Production

### P2.1 Scope check is HTTP-verb only, not resource-aware
**Files:**
- `packages/utils/scopes.js:46-51` — `methodToScope()` extracts only HTTP verb
- `apps/server/src/modules/tokens/token.service.js:83-84` — path is discarded
- `apps/proxy-service/src/modules/tokens/token.service.js:33-34` — same

**Bug:** `proxy:write` allows `POST /v1/chat/completions` AND `POST /v1/billing/charges` equally. A token scoped to "write messages" can also delete resources or access billing data, because scope only checks the HTTP method, not the semantic operation.

**Fix:**
- Extend `providerRegistry.js` with per-endpoint scope mappings (e.g., `anthropic: { endpoints: { 'POST /v1/messages': 'proxy:write' } }`)
- Replace `methodToScope()` with `endpointToScope(endpoint, provider)` that checks the path first, falls back to verb-based scope
- Start with top 5 providers (OpenAI, Anthropic, Stripe, GitHub, AWS), add others iteratively

### P2.2 Rate limiting is per-tier but not per-endpoint
**Files:**
- `packages/ratelimit/` — sliding window store, 3 tiers (IP, user, workspace)
- `apps/proxy-service/src/middleware/rateLimiter.js` — applies all 3 tiers to `/proxy/:provider/*`
- `apps/server/src/middleware/rateLimiter.js` — same

**Bug:** Rate limits are global per-tier — they don't distinguish between hitting `/proxy/openai/v1/chat` and `/proxy/stripe/v1/charges`. A token that hits OpenAI 300 times in a minute is blocked for Stripe too.

**Fix:** Add provider dimension to rate limit keys (e.g., `ratelimit:ip:192.168.1.1:openai`, `ratelimit:user:userId:stripe`).

---

## P3 — Nice to Have

### P3.1 OAuth callback and webhook routes swallow errors instead of calling `next(err)`
**Files:**
- `apps/server/src/modules/auth/auth.routes.js:100-101` — `res.status(500).send('Authentication failed')`
- `apps/server/src/modules/webhook/webhook.routes.js:55-56` — `res.status(500).json({ error: '...' })`
- `apps/server/src/modules/webhook/webhook.routes.js:75-76` — same

**Bug:** These routes catch errors but respond directly instead of calling `next(err)`. Errors never reach the global error handler — no proper error logging, no error type differentiation.

**Fix:** Change `(req, res)` to `(req, res, next)`, replace `res.status(500).json(...)` with `next(err)`.

### P3.2 `MAD_THRESHOLD` referenced but not imported in anomaly middleware
**File:** `apps/server/src/middleware/anomaly.middleware.js:11`

**Bug:** Line 11 references `MAD_THRESHOLD` which is defined in `anomalyDetector.service.js:4` but not exported. Causes `ReferenceError` at runtime. Caught by the inner try-catch so the process doesn't crash, but anomaly scoring silently never triggers.

**Fix:** Export `MAD_THRESHOLD` from `anomalyDetector.service.js` and import it in `anomaly.middleware.js`.

### P3.3 No `err.status` check in proxy-service global error handler
**File:** `apps/proxy-service/src/app.js:24`

**Bug:** Always returns HTTP 500 regardless of the error's status code. A validation error that should be 400 gets 500.

**Fix:** Use `err.status || err.statusCode || 500`.

### P3.4 Audit-service has no 404 handler and leaks `err.message` in production
**File:** `apps/audit-service/src/app.js`

**Bug:** Unmatched routes get Express default HTML response (not JSON). Error handler sends raw `err.message` to client — could leak internal details.

**Fix:** Add `app.use((req, res) => res.status(404).json({ error: 'NOT_FOUND' }))` before the error handler. Check `NODE_ENV` before sending `err.message`.

### P3.5 No shared `asyncHandler` wrapper exists
**Files:** All route files across all 3 services.

**Bug:** Every async route handler manually writes `try { ... } catch (err) { next(err) }`. 37 out of 39 handlers do this correctly, but it's boilerplate that can be eliminated.

**Fix:** Create `const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)` in a shared location. Use it across all routes.

### P3.6 Proxy middleware key decryption error returns 500 instead of forwarding to error handler
**Files:**
- `apps/proxy-service/src/modules/proxy/proxy.middleware.js:47-48`
- `apps/server/src/modules/proxy/proxy.middleware.js:102-105`

**Bug:** Key decryption failures return `res.status(500).json(...)` directly instead of calling `next(err)`. The error is not logged by the global error handler and does not include error details.

**Fix:** Either call `next(err)` or at minimum log `err.stack` before returning the 500 response.

---

## Summary Table

| ID | Severity | Area | Summary |
|---|---|---|---|
| P0.1 | 🔴 Crash | Server | `connectDB()` never imported in proxy & audit services |
| P0.2 | 🔴 Crash | Server | No `uncaughtException`/`unhandledRejection` handlers in any service |
| P0.3 | 🔴 Crash | DB | No MongoDB disconnect/reconnect listeners |
| P0.4 | 🔴 Error | Proxy | `proxyMiddleware` missing `next` param — errors are unhandled rejections |
| P0.5 | 🔴 Error | Proxy | Fire-and-forget audit logging has no `.catch()` |
| P0.6 | 🔴 Error | Proxy | `token.service.js` no try-catch around DB calls |
| P1.1 | 🟠 Security | Zero Trust | Standalone proxy has no anomaly detection |
| P1.2 | 🟠 Security | Zero Trust | Anomaly scoring is async (post-response), not a pre-flight gate |
| P1.3 | 🟠 Security | Zero Trust | Anomaly state is in-memory, lost on restart |
| P1.4 | 🟠 Security | Zero Trust | Non-proxy scopes (`tokens:read`, `audit:read`) defined but never enforced |
| P1.5 | 🔴 Security | Insider | `ENCRYPTION_KEY` on same server as DB — full compromise if both accessed |
| P1.6 | 🟠 UX | SDK | `vlt_` prefix rejected by all provider SDKs |
| P1.7 | 🟠 Security | Architecture | `PROXY_SERVICE_ENABLED=false` by default — single-process mode |
| P2.1 | 🟡 Scope | Scopes | HTTP-verb-only scope check, not resource-aware |
| P2.2 | 🟡 Rate | Rate limit | Not per-provider, cross-provider interference |
| P3.1 | ⚪ Quality | Routes | OAuth/webhook routes swallow errors |
| P3.2 | ⚪ Quality | Anomaly | `MAD_THRESHOLD` not imported — scoring silently fails |
| P3.3 | ⚪ Quality | Proxy | `err.status` not checked in global handler |
| P3.4 | ⚪ Quality | Audit | No 404 handler, leaks `err.message` |
| P3.5 | ⚪ Quality | All | No shared `asyncHandler` wrapper |
| P3.6 | ⚪ Quality | Proxy | Key decryption error returns 500 instead of forwarding |
