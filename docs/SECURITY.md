# Vaultify Security Model

## Overview

Vaultify solves the **deployment handoff problem** — the moment when developers paste real API keys into platform environment variable dashboards (Vercel, Netlify, Railway, etc.). When these platforms are breached, every stored key is immediately compromised.

Vaultify replaces real keys with **proxy tokens** that have zero independent value.

```
Before:  ANTHROPIC_API_KEY=sk-ant-real-abc123...   ← stored in Vercel (compromisable)
After:   PROXY_TOKEN=vlt_prod_8x2kqr9m...          ← stored in Vercel (worthless string)
```

---

## Trust Model

### What the vault server holds

- **Real API keys** — encrypted at rest with **AES-256-GCM** (256-bit key, random IV per encryption)
- **Encryption key** — stored as an environment variable on the vault server, never persisted to database
- **Decrypted keys** — held in memory for a single proxied request, then cleared; cached for max 60 seconds to reduce DB reads

### What the deployment platform holds

- **Proxy tokens only** — strings like `vlt_prod_8x2kqr9m...` that begin with the `vlt_` prefix
- **No real keys** — the platform never sees or stores actual API credentials

### What the SDK transmits

- **Proxy token** — sent as `Authorization: Bearer vlt_...` header
- **Request body** — the actual API payload (e.g., messages for Anthropic)
- **No real keys** — the SDK never has access to real API keys

---

## Token Security

### Token Format

```
vlt_{environment}_{32 random bytes in base58}

Examples:
  vlt_prod_8x2kqr9mzlwp4nvyt1j5bc6fhdes3ua7
  vlt_prev_3q9mwlzp4nvy1j5t8bc6fhdes3ua7x2k
  vlt_dev_1n4pvyt1j5bc6fhdes3ua7x2k8x2kqr9m
```

The `vlt_` prefix enables:
- **Secret scanning** tools (GitHub, GitGuardian) to flag accidental commits
- **Runtime validation** in the SDK (rejects non-`vlt_` tokens immediately)

### Token Scoping

Every proxy token is constrained by:

| Scope | Description |
|-------|-------------|
| **Allowed endpoints** | Locked to specific API paths (e.g., `POST /v1/messages` only) |
| **Allowed IPs** | CIDR range restrictions (e.g., Vercel's IP ranges) |
| **Rate limits** | Per-token daily request cap |
| **Expiry** | Time-based expiration (production: never, preview: 7 days, dev: 1 day) |
| **Environment** | Tied to production, preview, or development |

### Token Validation Pipeline

Every proxied request goes through a 6-step validation:

1. **Syntactic validation** — is this a valid `vlt_` format?
2. **Existence check** — does this token exist in the database?
3. **Revocation check** — has this token been revoked?
4. **Expiry check** — has this token expired?
5. **Endpoint check** — is the requested endpoint in the allowed list?
6. **IP + rate limit check** — is the caller IP allowed and within rate limits?

Only after all 6 checks pass does the server decrypt the real key and forward the request.

---

## Encryption Details

### Algorithm

- **AES-256-GCM** (Galois/Counter Mode)
- 256-bit encryption key
- Random 16-byte IV per encryption operation
- 16-byte authentication tag for tamper detection

### Key Storage

```
Database (MongoDB):
  ├── ciphertext   — encrypted API key
  ├── iv           — initialization vector (unique per key)
  └── authTag      — GCM authentication tag

Server Environment:
  └── ENCRYPTION_KEY — 32-byte hex string (64 hex characters)
```

The encryption key is **never stored in the database**. It exists only in the server's runtime environment.

### Key Lifecycle

1. **Store** — real key encrypted with AES-256-GCM, stored as `{ ciphertext, iv, authTag }`
2. **Proxy** — decrypted in-memory for a single request, then cleared from scope
3. **Rotate** — new key encrypted, old ciphertext replaced; all proxy tokens continue working
4. **Delete** — ciphertext removed from database; associated proxy tokens revoked

---

## Threat Model

### What Vaultify protects against

| Threat | Protection |
|--------|-----------|
| **Platform breach** (Vercel, Netlify) | Attacker gets `vlt_` tokens — worthless without vault server |
| **Token theft** | Scoped tokens limit blast radius (endpoint, IP, rate, expiry) |
| **Key rotation** | Zero-downtime — update key in vault, all tokens keep working |
| **Insider access** | Audit logs track every proxied request with IP, endpoint, latency |
| **Accidental commit** | `vlt_` prefix triggers secret scanners; token is worthless anyway |

### What Vaultify does NOT protect against

| Threat | Why |
|--------|-----|
| **Vault server compromise** | If the server + its `ENCRYPTION_KEY` env var are both compromised, real keys can be decrypted |
| **Man-in-the-middle** (without TLS) | Requests must use HTTPS; HTTP exposes both proxy tokens and API payloads |
| **Compromised application code** | If your app code is compromised, the attacker can use the proxy token to make requests (but within scope limits) |

### Mitigations for vault server security

- Run on a hardened, isolated server (not co-located with the application)
- Use environment-level encryption key management (e.g., AWS Secrets Manager, GCP Secret Manager)
- Enable MFA for vault server admin accounts
- Monitor audit logs for anomalies (geo, rate spikes, off-hours usage)

---

## Anomaly Detection

The server monitors for suspicious patterns:

- **New geolocations** — requests from IPs in countries not previously seen
- **Rate spikes** — sudden increases in request volume per token
- **Off-hours usage** — requests outside normal business hours
- **Consecutive failures** — multiple failed requests in sequence (potential brute force)

Alerts are sent via configured notification channels (Slack webhook, email via Resend).
