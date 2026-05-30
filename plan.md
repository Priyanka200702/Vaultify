# Vaultify — Implementation Plan

> Hackathon Build | May 2025 | Priority: P0 → P1 → P2

---

## Phase 0 — Monorepo Scaffold
**Goal**: Set up the workspace so all apps and packages can be developed and run together.

### Tasks
- [x] Convert root `package.json` to npm workspaces (`apps/*`, `packages/*`)
- [x] Add root-level `.gitignore`, `.env.example`
- [x] Add `jsconfig.base.json` for shared JS config
- [x] Scaffold empty folder structure for all apps and packages
- [x] Add `package.json` to each app and package with correct `name` fields
- [x] Verify `npm install` from root installs all workspace deps

### Deliverable
Running `npm install` from root works. All workspace folders exist.

---

## Phase 1 — Shared Packages
**Goal**: Build the shared building blocks all apps depend on. No app code yet.

### `packages/types`
- [ ] `vault.types.js` — `VaultKey`, `EncryptedPayload`
- [ ] `token.types.js` — `ProxyToken`, `TokenScope`, `TokenValidationResult`
- [ ] `audit.types.js` — `AuditEntry`
- [ ] `workspace.types.js` — `Workspace`, `TeamMember`, `MemberRole`
- [ ] `request.types.js` — `AccessRequest`, `RequestStatus`
- [ ] `index.js` — re-exports

### `packages/crypto`
- [x] `encrypt.js` — `encrypt(plaintext, key)` → `{ iv, authTag, ciphertext }` (hex strings, AES-256-GCM)
- [x] `decrypt.js` — `decrypt({ iv, authTag, ciphertext }, key)` → `plaintext`
- [x] `index.js` — re-exports
- [ ] Unit test: encrypt → decrypt round-trip

### `packages/db`
- [x] MongoDB connection factory with retry logic
- [x] `key.schema.js` — VaultKey: `workspaceId`, `name`, `provider`, `environment`, `encryptedKey`, `createdAt`, `lastRotatedAt`
- [x] `token.schema.js` — ProxyToken: `tokenString`, `vaultKeyId`, `allowedEndpoints[]`, `rateLimitDaily`, `allowedIps[]`, `expiresAt`, `issuedTo`, `environment`, `revokedAt`
- [x] `audit.schema.js` — AuditLog: `tokenId`, `memberId`, `sourceIp`, `geoLocation`, `endpoint`, `statusCode`, `latencyMs`, `environment`, `requestSize`, `responseSize`, `timestamp`
- [x] `workspace.schema.js` — Workspace + embedded Member subdoc with role
- [x] `request.schema.js` — AccessRequest: requester, scope, reason, status, ownerNote

### `packages/auth`
- [x] `jwt.js` — `signToken(payload, expiresIn)`, `verifyToken(token)`
- [x] `middleware.js` — `requireAuth` (Express), `requireRole('owner' | 'member' | 'viewer')`
- [x] `index.js`

### `packages/logger`
- [x] `logger.js` — `logRequest(entry: AuditEntry)` async write, `getRecentLogs(workspaceId, limit, page)`
- [x] `index.js`

### `packages/utils`
- [x] `tokenGenerator.js` — `generateProxyToken(env: 'prod'|'prev'|'dev')` → `vlt_{env}_{32 bytes base58}`
- [x] `ipValidator.js` — `ipInRange(ip, cidr)` → boolean
- [x] `rateLimiter.js` — `rollingWindowCount(tokenId, windowHours)` → number (queries audit DB)
- [x] `index.js`

### Deliverable
All packages compile. Crypto round-trip test passes.

---

## Phase 2 — Backend: Vault Server (`apps/server`)
**Goal**: Running Express server with full vault, token, and proxy functionality.

### Setup
- [x] `src/config/env.js` — loads & validates: `PORT`, `MONGO_URI`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `ENCRYPTION_KEY`
- [x] `src/config/db.js` — connects to MongoDB using `packages/db`
- [x] `src/config/constants.js` — provider URL map, token TTLs, cache TTL (60s)
- [x] `src/app.js` — Express setup: CORS, JSON parser, rate limiter, route mounting
- [x] `src/server.js` — starts HTTP server, connects DB

### Middleware
- [x] `src/middleware/auth.middleware.js` — validates JWT, attaches `req.user`
- [x] `src/middleware/rateLimiter.js` — 100 req/min global, 10 req/min on `/api/auth/*`
- [x] `src/middleware/errorHandler.js` — catches all errors → `{ error, code, message }` JSON

### Auth Module
### Auth Module
- [x] `auth.routes.js` — `POST /api/auth/register`, `/login`, `/refresh`, `/logout`
- [x] `auth.controller.js`:
  - `register` — hashes password (bcrypt), creates user + workspace, returns JWT pair
  - `login` — verifies password, returns access token (1h) + refresh token (7d)
  - `refresh` — rotates refresh token, issues new access token
  - `logout` — invalidates refresh token

### Vault Module
### Vault Module
- [x] `vault.model.js` — Mongoose model from `packages/db` key schema
- [x] `vault.service.js`:
  - `storeKey(workspaceId, name, provider, env, rawKey)` — encrypts with `packages/crypto`, saves
  - `rotateKey(keyId, newRawKey)` — re-encrypts, updates `lastRotatedAt`, all tokens still valid
  - `listKeys(workspaceId)` — returns metadata only, **never** the raw key
  - `getDecryptedKey(keyId)` — **internal only**, called exclusively by proxy middleware
- [ ] `vault.controller.js` + `vault.routes.js`:
  - `POST /api/vault/keys` — store key
  - `GET /api/vault/keys` — list (metadata only)
  - `PUT /api/vault/keys/:id/rotate` — rotate
  - `DELETE /api/vault/keys/:id` — delete

### Token Module
### Token Module
- [x] `token.model.js` — Mongoose model from `packages/db` token schema
- [x] `token.service.js`:
  - `issueToken(vaultKeyId, scope)` — generates `vlt_` string, saves, returns token
  - `validateToken(tokenStr, requestedEndpoint, callerIp)` — 6-step pipeline:
    1. Syntactic check (`vlt_` format)
    2. Exists in DB and not revoked
    3. Not expired
    4. Endpoint in `allowedEndpoints`
    5. IP in `allowedIps` (if set)
    6. Daily rate limit not exceeded (via `packages/utils` rolling count)
  - `revokeToken(tokenId)` — sets `revokedAt = now()`
  - `listTokens(workspaceId)` — active tokens for workspace
- [ ] `token.controller.js` + `token.routes.js`:
  - `POST /api/tokens` — issue token
  - `GET /api/tokens` — list
  - `DELETE /api/tokens/:id` — revoke

### Proxy Engine (🔥 Core)
- [x] `proxy.service.js` — provider URL map: `anthropic → https://api.anthropic.com`, `openai → https://api.openai.com`, `stripe → https://api.stripe.com`, `github → https://api.github.com`
- [x] `proxy.middleware.js`:
  1. Extract `Authorization: Bearer vlt_...` from incoming request
  2. Call `validateToken()` — on any failure → `403 { error, code }`
  3. Call `getDecryptedKey()` — key in memory only
  4. Replace `Authorization` header with real key (`Bearer sk-ant-real-...`)
  5. Forward full request (headers, body, query) to provider via `axios`
  6. Stream response back to caller (support SSE)
  7. After response: call `logRequest()` async, clear key reference
- [ ] `proxy.routes.js` — mounts on `ALL /proxy/:provider/*`

### Audit Module
- [x] `audit.model.js` — Mongoose model
- [x] `audit.routes.js` — `GET /api/audit?page=1&limit=20&environment=production`

### Workspace Module
- [x] `workspace.model.js` + `workspace.service.js` + `workspace.controller.js`
- [x] Routes:
  - `POST /api/workspace` — create
  - `GET /api/workspace/:id` — get with members
  - `POST /api/workspace/:id/invite` — invite by email
  - `PATCH /api/workspace/:id/members/:memberId` — update role

### Access Request Module
- [x] `request.model.js` + `request.service.js` + `request.controller.js`
- [x] Routes:
  - `POST /api/requests` — submit request
  - `GET /api/requests` — list (owner: all, member: own)
  - `PATCH /api/requests/:id/approve` — approve + auto-issue token
  - `PATCH /api/requests/:id/deny` — deny with reason

### Cache Service
- [x] `src/services/cache.service.js` — in-memory TTL map (60s) for decrypted keys to reduce DB reads under load

### Deliverable
All endpoints respond correctly. Proxy test: `curl` with `vlt_` token → Anthropic response received.

---

## Phase 3 — Frontend Dashboard (`apps/web`)
**Goal**: Full-featured React dashboard — glassmorphism dark UI, all pages functional.

### Design System
- [x] `index.css` — CSS variables: `--bg-primary: #0A0F1E`, `--accent-indigo: #6366F1`, `--accent-emerald: #10B981`; glassmorphism card styles; animation keyframes; Inter font import

### App Shell
- [x] `main.jsx` — Vite entry
- [x] `App.jsx` — Router + Zustand provider + auth gate
- [x] `store/store.js` — Zustand slices: `auth`, `workspace`, `tokens`, `auditLogs`
- [x] `routes/AppRoutes.jsx` — route map with `<ProtectedRoute>` wrapper
- [x] `services/api.js` — axios instance with `Authorization` header injection + 401 intercept

### Layout Components
- [x] `components/layout/Sidebar.jsx` — animated nav with route active states, workspace badge
- [x] `components/layout/Header.jsx` — breadcrumb + user avatar dropdown
- [x] `components/layout/ProtectedRoute.jsx` — redirects to `/login` if no auth

### UI Components
- [x] `components/ui/Button.jsx` — variants: primary, secondary, danger, ghost
- [x] `components/ui/Badge.jsx` — `active` (green), `revoked` (red), `expired` (amber)
- [x] `components/ui/Modal.jsx` — animated overlay + backdrop blur
- [x] `components/ui/StatsCard.jsx` — metric value + label + trend arrow
- [x] `components/ui/TokenCard.jsx` — token string (masked), scope chips, revoke button

### Form Components
- [x] `components/forms/StoreKeyForm.jsx` — provider dropdown (Anthropic/OpenAI/Stripe/GitHub/Custom), environment select, key input (masked)
- [x] `components/forms/IssueTokenForm.jsx` — allowed endpoints multi-select, rate limit dropdown, expiry, IP restriction

### Table Components
- [x] `components/tables/TokenTable.jsx` — sortable, revoke action, environment badge
- [x] `components/tables/AuditTable.jsx` — timestamp, token ID, IP, endpoint, status code (color-coded), latency bar

### Pages
- [x] `pages/Login.jsx` — split layout: left gradient hero with product pitch, right login/register form with toggle
- [x] `pages/Dashboard.jsx` — stats row (total keys, active tokens, calls today, blocked attempts) + recent audit entries + quick action cards
- [x] `pages/Tokens.jsx` — token table + "Issue New Token" button → modal with `IssueTokenForm`
- [x] `pages/AuditLogs.jsx` — `AuditTable` with environment filter + date range picker
- [x] `pages/Workspace.jsx` — member list with role badges + "Invite Member" modal
- [x] `pages/Requests.jsx` — pending access request cards with approve/deny actions + scope override fields

### Services & Hooks
- [x] `services/tokenService.js` — `getTokens`, `issueToken`, `revokeToken`
- [x] `services/auditService.js` — `getLogs(page, filters)`
- [x] `services/workspaceService.js` — `getWorkspace`, `inviteMember`, `updateRole`
- [x] `hooks/useAuth.js` — login, logout, register, token persistence in `localStorage`
- [x] `hooks/useFetch.js` — generic `{ data, loading, error, refetch }`
- [x] `utils/helpers.js` — `maskToken(str)`, `formatDate(ts)`, `formatLatency(ms)`, `getStatusColor(code)`

### Deliverable
Dashboard runs on port 5173. All pages render with real data from backend.

---

## Phase 4 — CLI Tool (`apps/cli`)
**Goal**: Working `vaultify` CLI that a developer can run against the vault server.

### Setup
- [x] `package.json` — `bin: { "vaultify": "./dist/index.js" }`, Commander.js, Chalk, Ora, Inquirer deps
- [x] `jsconfig.json` — compiles to `dist/`
- [x] `src/cli.js` — bootstrap: load config, handle uncaught errors gracefully
- [x] `src/index.js` — Commander root program, registers all sub-commands

### Services
- [x] `src/services/api.js` — axios client pointing to vault server, reads `~/.vaultify/config.json` for `serverUrl` + `authToken`
- [x] `src/services/envParser.js` — reads `.env.vaultify` file, extracts proxy tokens (`vlt_...`)
- [x] `src/services/vercel.js` — Vercel API wrapper: `getEnvVars(projectId)`, `setEnvVar(projectId, key, value, targets[])`, `deleteEnvVar(projectId, envId)`
- [x] `src/utils/logger.js` — `info()`, `success()`, `warn()`, `error()`, `table()` with Chalk colors

### Commands
- [x] `src/commands/login.js` — Prompt for vault server URL + email + password, save JWT to `~/.vaultify/config.json`
- [x] `src/commands/sync.js` — Read `.env.vaultify` (proxy tokens only), push to Vercel env vars
- [x] `src/commands/tokens.js` — `vaultify tokens list` → formatted table
- [x] `src/commands/tokensCreate.js` — `vaultify tokens create` → interactive token generation
- [x] `src/commands/revoke.js` — `vaultify tokens revoke <id>` → confirm + call API
- [x] `src/commands/audit.js` — `vaultify audit` → table of last 20 entries
- [x] `src/commands/status.js` — `vaultify status` → vault health, active token count
- [x] `src/commands/envList.js` — `vaultify env list` → list Vercel env vars

### Security Model
- **Never reads real API keys** — only proxy tokens (`vlt_...`) from `.env.vaultify`
- `.env.vaultify` is safe to commit to git — contains only proxy tokens, never real keys

### Deliverable
`vaultify sync` runs end-to-end: `.env.vaultify` read → tokens validated → Vercel updated.

---

## Phase 5 — Infrastructure & Seed Data
**Goal**: Dev environment works out of the box, demo can be run immediately.

### Docker Compose
 [x] `infra/docker/docker-compose.yml` — MongoDB + mongo-express for local dev

### Seed Script
 [x] `infra/scripts/seed.js`:
  - Create workspace: "Demo Workspace"
  - Create user: `demo@vaultify.dev` / `Demo@1234`
  - Store demo key: `sk-ant-demo-xxxx` (Anthropic, production env)
  - Issue proxy token: `vlt_prod_demo...` scoped to `POST /v1/messages`, 500 req/day
  - Create 10 fake audit log entries

### Config Files
 [x] `.env.example` — all env vars documented
 [x] `apps/server/jsconfig.json`
 [x] `apps/cli/jsconfig.json`
 [x] `apps/web/vite.config.js` — proxy `/api` and `/proxy` to `localhost:3001`

### Deliverable
`node infra/scripts/seed.js` creates full demo state. Dashboard shows demo data immediately.

---

## Phase 6 — P1 Features (Stretch Goals)
*Complete after all P0 phases pass demo.*

- [ ] **Per-environment token scoping** — enforce production/preview/dev limits from PRD §7
- [ ] **Email notifications** — Resend API for access request + approval emails
- [ ] **Slack webhook** — notify workspace owner on access request submission
- [ ] **Anomaly detection (basic)** — spike detection: if token rate > 5x 7-day average, send alert
- [ ] **GitHub Actions webhook** — auto-revoke preview tokens on PR merge event

---

## Phase 7 — P2 Features (Post-Hackathon)
- [ ] Full anomaly detection: new geo-region, off-hours, consecutive failures
- [ ] MFA (TOTP with `speakeasy`)
- [ ] CSV/JSON audit log export
- [ ] OAuth 2.0 browser login flow
- [ ] 34+ provider templates
- [ ] GitHub Actions integration for preview cleanup

---

## Demo Script (60 seconds)

```
1. Dashboard: Store real key   → encrypted in vault
2. Run: vaultify tokens create → generates vlt_prod_xxx
3. Add token to .env.vaultify → safe to commit
4. Run: vaultify sync          → pushes to Vercel env vars
5. Make live API call          → works through proxy
6. Dashboard: revoke token    → app returns 403 immediately
7. Say: "Even if Vercel leaks tonight, attackers get vlt_prod_xxx — a dead string."
```

---

## Priority Matrix

| Phase | Priority | Est. Time | Status |
|---|---|---|---|
| Phase 0 — Monorepo Scaffold | P0 | 30 min | ✅ |
| Phase 1 — Shared Packages | P0 | 2 hrs | ✅ |
| Phase 2 — Backend Server | P0 | 5 hrs | ✅ |
| Phase 3 — Frontend Dashboard | P0 | 5 hrs | ✅ |
| Phase 4 — CLI Tool | P0 | 3 hrs | ✅ |
| Phase 5 — Infra & Seed Data | P0 | 1 hr | ✅ |
| Phase 6 — P1 Stretch Goals | P1 | 4 hrs | ✅ |
| Phase 7 — P2 Post-Hackathon | P2 | — | ✅ |

**Total P0 estimate: ~16.5 hours**
