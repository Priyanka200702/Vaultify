# 🔐 Vaultify

> **"The token Vercel holds is cryptographically worthless without our server — we turned a credential into a claim ticket."**

Vaultify is a developer security tool that eliminates the root cause of API key exposure on deployment platforms like Vercel, Netlify, and Railway. Instead of storing real API keys (`sk-ant-real...`) in platform environment variables, Vaultify issues short-lived, scope-limited **proxy tokens** (`vlt_prod_abc123`) that have zero independent value. The real keys never leave Vaultify's vault server.

---

## 🧠 The Core Insight

Every cloud deployment platform requires developers to paste real API keys into their environment variable dashboards. When these platforms are breached (as Vercel was in 2024), every stored key is immediately compromised.

**Vaultify solves the deployment handoff itself** — the exact moment keys get exposed.

```
Before Vaultify:  ANTHROPIC_API_KEY=sk-ant-real-abc123...   ← stored in Vercel
After Vaultify:   PROXY_TOKEN=vlt_prod_8x2kqr9m...          ← stored in Vercel (worthless string)
```

Even if the platform leaks tonight, attackers get `vlt_prod_8x2kqr9m` — a dead string.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🏦 **Encrypted Vault** | Real API keys stored with AES-256-GCM encryption. Never returned in any API response. |
| 🔀 **Proxy Engine** | Validates proxy tokens, injects real keys in-memory, forwards requests to providers. Real key lives in memory for one request only. |
| 🎫 **Scoped Proxy Tokens** | Tokens locked to specific endpoints, IP ranges, rate limits, and expiry windows. |
| 👥 **Team Workspaces** | Access request workflow — teammates request tokens, owners approve with custom scope overrides. |
| 📋 **Audit Logs** | Per-call visibility: who called what endpoint, from where, with what latency. |
| ⚡ **Zero-Downtime Rotation** | Rotate the real key once in the vault. Every proxy token continues working automatically. |
| 🚨 **Anomaly Detection** | Alerts on new geolocations, rate spikes, off-hours usage, and consecutive failures. |
| 🔧 **CLI Tool** | `vaultify push` replaces real keys with proxy tokens in Vercel env vars in one command. |

---

## 🛠 Tech Stack

### Backend — `apps/server`

| Layer | Technology | Purpose |
|---|---|---|
| Runtime | Node.js 18+ | Server runtime |
| Framework | Express.js | HTTP server, routing, middleware |
| Language | JavaScript | Runtime-safe modules across the backend |
| Database | MongoDB (Mongoose) | Persistent storage for keys, tokens, logs |
| Encryption | Node.js `crypto` (AES-256-GCM) | Encrypts real API keys at rest |
| Auth | JWT (`jsonwebtoken`) + bcrypt | Session management, password hashing |
| Rate Limiting | `express-rate-limit` | Abuse prevention on all endpoints |
| HTTP Forwarding | `axios` | Proxying requests to provider APIs |
| Caching | In-memory TTL cache | 60s key cache to reduce DB reads under load |

### Frontend — `apps/web`

| Layer | Technology | Purpose |
|---|---|---|
| Framework | React 18 | Component-based UI |
| Build Tool | Vite | Fast dev server + production bundler |
| Routing | React Router v6 | Client-side navigation |
| State | Zustand | Global auth + workspace state |
| Language | JSX | All component files |
| Styling | Vanilla CSS | Design tokens, glassmorphism, animations |
| Font | Inter (Google Fonts) | Modern typography |

### CLI — `apps/cli`

| Layer | Technology | Purpose |
|---|---|---|
| Runtime | Node.js 18+ | CLI execution |
| Framework | Commander.js | Sub-command routing |
| Language | JavaScript | Runtime-safe API calls and env parsing |
| UX | Chalk + Ora + Inquirer | Colors, spinners, interactive prompts |
| Config | `~/.vaultify/config.json` | Stores auth token locally |
| Integration | Vercel API | Reads/writes env vars on Vercel projects |

### Shared Packages

| Package | Purpose |
|---|---|
| `packages/crypto` | AES-256-GCM encrypt/decrypt helpers |
| `packages/db` | Mongoose schemas and MongoDB connection |
| `packages/auth` | JWT sign/verify + Express middleware |
| `packages/logger` | Audit log write + query utilities |
| `packages/types` | Shared JavaScript modules |
| `packages/utils` | Token generation, IP validation, rate window helpers |

---

## 📁 Folder Structure

```
vaultify/
│
├── apps/
│   │
│   ├── server/                          # 🏦 Vault Server (Express + JavaScript)
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   ├── db.js                # MongoDB connection with retry logic
│   │   │   │   ├── env.js               # Env var validation (MONGO_URI, JWT_SECRET, etc.)
│   │   │   │   └── constants.js         # App-wide constants (TTLs, limits, provider URLs)
│   │   │   │
│   │   │   ├── modules/
│   │   │   │   │
│   │   │   │   ├── auth/
│   │   │   │   │   ├── auth.controller.js   # Register, login, refresh, logout
│   │   │   │   │   └── auth.routes.js       # POST /api/auth/*
│   │   │   │   │
│   │   │   │   ├── vault/
│   │   │   │   │   ├── vault.controller.js  # HTTP handlers for key CRUD
│   │   │   │   │   ├── vault.service.js     # storeKey, rotateKey, getDecryptedKey
│   │   │   │   │   ├── vault.model.js       # Mongoose schema for VaultKey
│   │   │   │   │   └── vault.routes.js      # POST/GET/PUT/DELETE /api/vault/keys
│   │   │   │   │
│   │   │   │   ├── tokens/
│   │   │   │   │   ├── token.controller.js  # Issue, list, revoke tokens
│   │   │   │   │   ├── token.service.js     # issueToken, validateToken (6-step pipeline)
│   │   │   │   │   ├── token.model.js       # Mongoose schema for ProxyToken
│   │   │   │   │   └── token.routes.js      # POST/GET/DELETE /api/tokens
│   │   │   │   │
│   │   │   │   ├── proxy/                   # 🔥 Core Proxy Engine
│   │   │   │   │   ├── proxy.middleware.js  # Token validation → key inject → forward → log
│   │   │   │   │   ├── proxy.service.js     # Provider URL resolution map
│   │   │   │   │   └── proxy.routes.js      # ALL /proxy/:provider/* routes
│   │   │   │   │
│   │   │   │   ├── audit/
│   │   │   │   │   ├── audit.model.js       # Mongoose schema for AuditLog entry
│   │   │   │   │   └── audit.routes.js      # GET /api/audit (paginated)
│   │   │   │   │
│   │   │   │   ├── workspace/
│   │   │   │   │   ├── workspace.controller.js  # Create, get, invite member, update role
│   │   │   │   │   ├── workspace.service.js
│   │   │   │   │   └── workspace.model.js       # Workspace + Member schemas
│   │   │   │   │
│   │   │   │   └── access/
│   │   │   │       ├── request.controller.js    # Submit, approve, deny access requests
│   │   │   │       ├── request.service.js       # Auto-issues token on approval
│   │   │   │       └── request.model.js         # AccessRequest schema
│   │   │   │
│   │   │   ├── middleware/
│   │   │   │   ├── auth.middleware.js       # JWT validation, attaches req.user
│   │   │   │   ├── rateLimiter.js           # express-rate-limit config
│   │   │   │   └── errorHandler.js          # Global error → structured JSON
│   │   │   │
│   │   │   ├── services/
│   │   │   │   ├── encryption.service.js    # AES-256-GCM wrap over packages/crypto
│   │   │   │   ├── token.service.js         # Proxy token generation (vlt_ format)
│   │   │   │   └── cache.service.js         # In-memory TTL cache (60s for decrypted keys)
│   │   │   │
│   │   │   ├── lib/
│   │   │   │   ├── axios.js                 # Configured axios instance for forwarding
│   │   │   │   └── vercel.js                # Vercel API client (used by CLI integration)
│   │   │   │
│   │   │   ├── app.js                       # Express app setup, middleware, route mounting
│   │   │   └── server.js                    # HTTP server entry point
│   │   │
│   │   ├── package.json
│   │   └── jsconfig.json
│   │
│   ├── web/                             # 🖥 Dashboard (React 18 + Vite)
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── Login.jsx            # Animated login/register with gradient hero
│   │   │   │   ├── Dashboard.jsx        # Stats cards + activity feed + quick actions
│   │   │   │   ├── Tokens.jsx           # Token list, issue new token modal, revoke
│   │   │   │   ├── AuditLogs.jsx        # Filterable table: IP, latency, status badges
│   │   │   │   ├── Workspace.jsx        # Team members, invite modal, role management
│   │   │   │   └── Requests.jsx         # Pending requests: approve/deny with override
│   │   │   │
│   │   │   ├── components/
│   │   │   │   ├── layout/
│   │   │   │   │   ├── Sidebar.jsx          # Animated nav sidebar
│   │   │   │   │   ├── Header.jsx           # Workspace switcher + user menu
│   │   │   │   │   └── ProtectedRoute.jsx   # Auth guard HOC
│   │   │   │   │
│   │   │   │   ├── ui/
│   │   │   │   │   ├── TokenCard.jsx        # Token display with scope chips
│   │   │   │   │   ├── StatsCard.jsx        # Metric card with trend indicator
│   │   │   │   │   ├── Badge.jsx            # Status badge (active/revoked/expired)
│   │   │   │   │   ├── Modal.jsx            # Animated modal wrapper
│   │   │   │   │   └── Button.jsx           # Design system button with variants
│   │   │   │   │
│   │   │   │   ├── forms/
│   │   │   │   │   ├── IssueTokenForm.jsx   # Scope-limited token issuance form
│   │   │   │   │   └── StoreKeyForm.jsx     # Vault key storage with provider dropdown
│   │   │   │   │
│   │   │   │   └── tables/
│   │   │   │       ├── AuditTable.jsx       # Paginated audit log table
│   │   │   │       └── TokenTable.jsx       # Token management table
│   │   │   │
│   │   │   ├── services/
│   │   │   │   ├── api.js               # Axios base client with auth headers
│   │   │   │   ├── tokenService.js      # Token CRUD API calls
│   │   │   │   ├── auditService.js      # Audit log API calls
│   │   │   │   └── workspaceService.js  # Workspace + member API calls
│   │   │   │
│   │   │   ├── hooks/
│   │   │   │   ├── useAuth.js           # Auth state + login/logout actions
│   │   │   │   └── useFetch.js          # Generic data fetching with loading/error
│   │   │   │
│   │   │   ├── store/
│   │   │   │   └── store.js             # Zustand: auth, workspace, tokens, auditLogs
│   │   │   │
│   │   │   ├── routes/
│   │   │   │   └── AppRoutes.jsx        # All route definitions + auth guards
│   │   │   │
│   │   │   ├── utils/
│   │   │   │   └── helpers.js           # Date formatting, token masking, etc.
│   │   │   │
│   │   │   ├── App.jsx                  # Root component with router + providers
│   │   │   └── main.jsx                 # Vite entry — mounts <App />
│   │   │
│   │   ├── public/
│   │   ├── index.html
│   │   ├── index.css                    # Design tokens, glassmorphism, animations
│   │   ├── vite.config.js
│   │   └── package.json
│   │
│   └── cli/                             # 🔧 CLI Tool (Node.js + Commander.js)
│       ├── src/
│       │   ├── commands/
│       │   │   ├── login.js             # Browser OAuth / email-password → saves JWT locally
│       │   │   ├── push.js              # Scan .env → issue tokens → push to Vercel API
│       │   │   ├── tokens.js            # vaultify tokens list
│       │   │   ├── revoke.js            # vaultify tokens revoke <id>
│       │   │   ├── rotate.js            # vaultify rotate <key-name> (zero downtime)
│       │   │   └── audit.js             # vaultify audit (last 20 log entries)
│       │   │
│       │   ├── services/
│       │   │   ├── api.js               # Axios client → vault server (reads ~/.vaultify/config)
│       │   │   ├── envParser.js         # Parses .env, identifies real keys by regex
│       │   │   └── vercel.js            # Vercel API wrapper: get/set/delete env vars
│       │   │
│       │   ├── utils/
│       │   │   └── logger.js            # Chalk-colored terminal output helpers
│       │   │
│       │   ├── index.js                 # Commander.js entry — registers all commands
│       │   └── cli.js                   # CLI bootstrap + error handling
│       │
│       ├── package.json
│       └── jsconfig.json
│
├── packages/
│   │
│   ├── crypto/                          # 🔒 AES-256-GCM Encryption
│   │   ├── encrypt.js                   # encrypt(plaintext, key) → { iv, authTag, ciphertext }
│   │   ├── decrypt.js                   # decrypt({ iv, authTag, ciphertext }, key) → plaintext
│   │   └── index.js                     # Re-exports
│   │
│   ├── db/                              # 🗄 MongoDB Schemas
│   │   ├── schemas/
│   │   │   ├── key.schema.js            # VaultKey: encrypted key + metadata
│   │   │   ├── token.schema.js          # ProxyToken: full scope fields
│   │   │   ├── audit.schema.js          # AuditLog: per-request log entry
│   │   │   ├── workspace.schema.js      # Workspace + Member roles
│   │   │   └── request.schema.js        # AccessRequest: submit/approve/deny workflow
│   │   └── index.js                     # Connection factory + schema exports
│   │
│   ├── auth/                            # 🔑 JWT Helpers
│   │   ├── jwt.js                       # signToken, verifyToken
│   │   ├── middleware.js                # requireAuth, requireRole Express middleware
│   │   └── index.js
│   │
│   ├── logger/                          # 📝 Audit Logger
│   │   ├── logger.js                    # logRequest(entry), getRecentLogs(workspaceId, limit)
│   │   └── index.js
│   │
│   ├── types/                           # 📐 Shared JavaScript Modules
│   │   ├── vault.types.js               # VaultKey, EncryptedPayload
│   │   ├── token.types.js               # ProxyToken, TokenScope, TokenValidationResult
│   │   ├── audit.types.js               # AuditEntry
│   │   ├── workspace.types.js           # Workspace, TeamMember, MemberRole
│   │   ├── request.types.js             # AccessRequest, RequestStatus
│   │   └── index.js
│   │
│   └── utils/                           # 🔧 Common Helpers
│       ├── tokenGenerator.js            # generateProxyToken(env) → vlt_{env}_{32 bytes base58}
│       ├── ipValidator.js               # ipInRange(ip, cidr) → boolean
│       ├── rateLimiter.js               # rollingWindowCount(tokenId, windowHours) → number
│       └── index.js
│
├── infra/
│   ├── docker/
│   │   └── docker-compose.yml           # Local MongoDB + server for development
│   ├── nginx/
│   │   └── nginx.conf                   # Reverse proxy config (optional production)
│   └── scripts/
│       ├── seed.js                      # Seeds demo workspace, keys, and tokens
│       └── deploy.sh                    # Deployment helper script
│
├── .env.example                         # All required env vars with comments
├── .gitignore
├── package.json                         # Root — npm workspaces config
├── README.md                            # This file
└── plan.md                              # Phased implementation plan
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- npm 8+

### 1. Clone & Install

```bash
git clone https://github.com/your-org/vaultify.git
cd vaultify
npm install          # installs all workspace packages
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your MongoDB URI, JWT secret, and encryption key
```

### 3. Run Dev Servers

```bash
# Terminal 1 — Backend vault server (port 3001)
cd apps/server && npm run dev

# Terminal 2 — Frontend dashboard (port 5173)
cd apps/web && npm run dev

# Terminal 3 — Seed demo data (optional)
npm run seed
```

### 3.1 Login As Demo User

After seeding, sign in to the dashboard with:

- Email: `demo@vaultify.dev`
- Password: `Demo@1234`

### 4. Use the CLI

```bash
npm install -g @vaultify/cli    # or: npx vaultify

vaultify login                  # authenticate with your vault server
vaultify push                   # replace .env real keys with proxy tokens in Vercel
vaultify tokens list            # view all active proxy tokens
vaultify tokens revoke <id>     # immediately revoke a token
vaultify rotate <key-name>      # zero-downtime key rotation
vaultify audit                  # view last 20 audit log entries
```

---

## 🔑 Environment Variables

### `apps/server/.env`

```env
# Server
PORT=3001
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/vaultify

# Security
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
REFRESH_TOKEN_SECRET=your-refresh-token-secret
ENCRYPTION_KEY=your-32-byte-hex-encryption-key  # used for AES-256-GCM

# Notifications (optional)
RESEND_API_KEY=re_xxxx
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### `apps/web/.env`

```env
VITE_API_BASE_URL=http://localhost:3001
```

### `apps/cli` (stored in `~/.vaultify/config.json` after login)

```json
{
  "serverUrl": "https://your-vault-server.render.com",
  "authToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## 🔐 Security Model

### How a Proxied Request Works

```
Your App (Vercel)
     │
     │  Authorization: Bearer vlt_prod_8x2kqr9m   ← proxy token
     ▼
Vaultify Proxy Server
     │
     ├── 1. Syntactic validation (is this a valid vlt_ token?)
     ├── 2. Token exists in DB and is not revoked?
     ├── 3. Token has not expired?
     ├── 4. Requested endpoint is in allowed_endpoints?
     ├── 5. Caller IP is in allowed_ips?
     └── 6. Daily rate limit not exceeded?
          │
          ▼ (all checks pass)
     Decrypt real key from vault (in memory only)
          │
          │  Authorization: Bearer sk-ant-real-...   ← real key injected
          ▼
     api.anthropic.com   ← real API provider
          │
          ▼
     Response streamed back to your app
     Real key reference cleared from memory
     Audit log entry written async
```

### Token Format

```
vlt_{env}_{32 random bytes in base58}

Examples:
  vlt_prod_8x2kqr9mzlwp4nvyt1j5bc6fhdes3ua7
  vlt_prev_3q9mwlzp4nvy1j5t8bc6fhdes3ua7x2k
  vlt_dev_1n4pvyt1j5bc6fhdes3ua7x2k8x2kqr9m
```

The `vlt_` prefix enables secret scanning tools to automatically flag accidental token leaks.

---

## 🧩 Integration Example

The only change a developer makes to their application code:

```js
// Before Vaultify — real key in Vercel env vars
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_KEY     // ← sk-ant-real-... stored in Vercel dashboard
})

// After Vaultify — proxy token in Vercel env vars
const client = new Anthropic({
  apiKey: process.env.PROXY_TOKEN,      // ← vlt_prod_8x2k... (worthless without vault server)
  baseURL: "https://proxy.vaultify.dev" // ← your vault server proxy endpoint
})
```

---

## 🏗 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Developer Workflow                     │
│                                                           │
│  .env file → vaultify push → Vercel stores vlt_ token    │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│                   Vaultify Vault Server                   │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Vault Store │  │ Proxy Engine │  │  Audit Logger │  │
│  │  AES-256-GCM │  │  Token Valid │  │  Per-request  │  │
│  │  MongoDB     │  │  Key Inject  │  │  MongoDB      │  │
│  └──────────────┘  └──────┬───────┘  └───────────────┘  │
│                           │                               │
└───────────────────────────┼─────────────────────────────┘
                            │
              ┌─────────────▼─────────────┐
              │     Real API Provider     │
              │  api.anthropic.com        │
              │  api.openai.com           │
              │  api.stripe.com           │
              └───────────────────────────┘
```

---

## 🏆 Competitive Advantage

| Feature | Vaultify | Doppler | API Locker |
|---|---|---|---|
| Real key never sent to Vercel | ✅ | ❌ | ❌ |
| Vercel-native CLI push | ✅ | ✅ | ❌ |
| Scope-limited proxy tokens | ✅ | ❌ | ✅ |
| Team access request flow | ✅ | ✅ | ❌ |
| Request-level audit logs | ✅ | ❌ | ✅ |
| Zero-downtime key rotation | ✅ | ✅ | ✅ |
| Anomaly detection | ✅ | ❌ | ❌ |

---

## 📄 Demo Credentials

For local testing after running the seed script:

| Field | Value |
|---|---|
| Email | `demo@vaultify.dev` |
| Password | `Demo@1234` |
| Test API Key | `sk-ant-demo-xxxxxxxxxxxxxxxx` |
| Test Proxy Token | `vlt_dev_demo...` (generated on seed) |

---

## 📋 License

MIT © 2025 Vaultify Team
