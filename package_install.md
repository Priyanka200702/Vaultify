# Vaultify — SDK + CLI Publish

Publish two npm packages from the existing monorepo:
- **`vaultify`** — lightweight SDK exposing `createClient(proxyToken, opts)` that acts as a drop-in wrapper routing calls through the Vaultify proxy server.
- **`vaultify-cli`** — the existing CLI from `apps/cli`, prepared for public npm publishing with a `vaultify` bin.

---

## User Review Required

> [!IMPORTANT]
> **Package naming** — The todo.md mentions both `vaultify-cli` and `@vaultify/cli` (scoped). The CLI's current `package.json` uses `@vaultify/cli`. Scoped packages require `--access public` to be usable via `npx`. **Recommendation: keep `@vaultify/cli` for consistency with the existing `@vaultify/*` namespace**, but this means `npx @vaultify/cli login` instead of `npx vaultify-cli login`.

> [!IMPORTANT]
> **SDK package name conflicts** — The root `package.json` already uses `"name": "vaultify"`. We need to rename the root to something like `vaultify-monorepo` (it's `private: true` so this won't publish) and give the SDK the `vaultify` name. Alternatively, the SDK could be `@vaultify/sdk`. **Recommendation: SDK = `vaultify` (unscoped), root = `vaultify-monorepo`.**

> [!WARNING]
> **Default proxy base URL** — The todo.md suggests `https://proxy.vaultify.dev`. The server currently routes proxy calls at `/proxy/:provider/*`. The SDK needs to know this full shape. **Please confirm the production domain** so I can hardcode the correct default.

## Open Questions

1. **Provider abstraction depth** — The todo says the SDK should provide "minimal compatibility wrapper so code using Anthropic style `client.messages.create()` works." Should I support *only* Anthropic-style `messages.create`, or also OpenAI-style `chat.completions.create`? Recommendation: start with **only `messages.create()` + a generic `request(method, path, body)`** and let users add OpenAI style later.

2. **Streaming support** — The server's proxy already streams responses. Should the SDK expose a streaming API (e.g., `messages.create({ stream: true })` returning an async iterator)? Recommendation: **yes, include streaming** since Anthropic SDK users expect it.

3. **Version numbers** — Start both packages at `0.1.0` (pre-1.0 semver) or `1.0.0`? Recommendation: **`0.1.0`** to signal early stage.

---

## Proposed Changes

### Phase 1 — Design & Root Config

#### [MODIFY] [package.json](file:///d:/Projects/Vaultify/package.json)
- Rename `"name"` from `"vaultify"` to `"vaultify-monorepo"` to free the `vaultify` name for the SDK.
- No other changes; `workspaces` array already includes `packages/*`.

---

### Phase 2 — Scaffold SDK Package

#### [NEW] [packages/vaultify/package.json](file:///d:/Projects/Vaultify/packages/vaultify/package.json)
```json
{
  "name": "vaultify",
  "version": "0.1.0",
  "private": false,
  "description": "Vaultify SDK — route API calls through the Vaultify proxy using secure proxy tokens",
  "main": "index.js",
  "exports": {
    ".": "./index.js"
  },
  "files": ["index.js", "lib/", "README.md", "LICENSE"],
  "engines": { "node": ">=18" },
  "keywords": ["vaultify", "proxy", "api-keys", "security", "anthropic", "openai"],
  "license": "MIT",
  "repository": { "type": "git", "url": "https://github.com/vivaswanghosh/Vaultify" },
  "homepage": "https://github.com/vivaswanghosh/Vaultify#readme"
}
```
Zero runtime dependencies — uses native `fetch` (Node 18+) and `ReadableStream`.

#### [NEW] [packages/vaultify/index.js](file:///d:/Projects/Vaultify/packages/vaultify/index.js)
Main entry point. Exports `createClient` and `VaultifyError`.

#### [NEW] [packages/vaultify/lib/client.js](file:///d:/Projects/Vaultify/packages/vaultify/lib/client.js)
Core client class:
- Constructor: `new VaultifyClient(proxyToken, { baseUrl, provider, timeout })`
- Validates token format (`vlt_` prefix)
- `request(method, path, body, opts)` — generic method
- `messages.create(payload)` — Anthropic-compatible wrapper that calls `POST /proxy/anthropic/v1/messages`
- Streaming support via `messages.create({ ...payload, stream: true })` returning an async iterator

#### [NEW] [packages/vaultify/lib/errors.js](file:///d:/Projects/Vaultify/packages/vaultify/lib/errors.js)
Custom `VaultifyError` class extending `Error`, with `status`, `code`, and `body` fields.

#### [NEW] [packages/vaultify/lib/stream.js](file:///d:/Projects/Vaultify/packages/vaultify/lib/stream.js)
SSE stream parser that converts `text/event-stream` responses into an async iterable of parsed event objects.

#### [NEW] [packages/vaultify/README.md](file:///d:/Projects/Vaultify/packages/vaultify/README.md)
SDK readme with:
- Install instructions
- Quick start: `createClient()` → `messages.create()` example
- Streaming example
- Migration from Anthropic SDK (one-line change)
- Security note (proxy token is worthless without vault server)
- API reference

#### [NEW] [packages/vaultify/LICENSE](file:///d:/Projects/Vaultify/packages/vaultify/LICENSE)
MIT license file.

---

### Phase 3 — SDK Implementation Details

The SDK's `createClient` function will work like this:

```js
const { createClient } = require('vaultify');

// Basic usage
const client = createClient('vlt_prod_abc123', {
  baseUrl: 'https://proxy.vaultify.dev',  // or VAULTIFY_SERVER_URL env var
});

// Anthropic-compatible: messages.create()
const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello' }],
});

// Streaming
const stream = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello' }],
  stream: true,
});
for await (const event of stream) {
  process.stdout.write(event.delta?.text || '');
}

// Generic request (any provider)
const result = await client.request('POST', '/proxy/openai/v1/chat/completions', {
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello' }],
});
```

**Key design decisions:**
- **Zero dependencies** — uses Node 18+ native `fetch`. Works in browsers natively, works in Node 18+ without polyfills.
- **Provider-aware path building** — `messages.create()` auto-routes to `/proxy/anthropic/v1/messages`. The `provider` option defaults to `'anthropic'` but can be overridden.
- **Auth header** — sends `Authorization: Bearer <proxyToken>` on every request (matches the server's [proxy.middleware.js](file:///d:/Projects/Vaultify/apps/server/src/modules/proxy/proxy.middleware.js#L26-L38) extraction logic).
- **Token validation** — throws immediately if token doesn't start with `vlt_`.
- **Base URL resolution** — checks `opts.baseUrl` → `process.env.VAULTIFY_SERVER_URL` → `'https://proxy.vaultify.dev'`.

---

### Phase 4 — Tests

#### [NEW] [packages/vaultify/\_\_tests\_\_/client.test.js](file:///d:/Projects/Vaultify/packages/vaultify/__tests__/client.test.js)
Unit tests (using Node's built-in `node:test` + `node:assert` — zero test dependencies):
- ✅ `createClient()` throws on missing/invalid token
- ✅ `createClient()` reads `VAULTIFY_SERVER_URL` env when no baseUrl given
- ✅ `messages.create()` sends correct URL, headers, and body
- ✅ `messages.create({ stream: true })` returns async iterator
- ✅ `request()` sends arbitrary method/path/body
- ✅ Error responses throw `VaultifyError` with correct status/code
- ✅ Token format validation accepts `vlt_*` and rejects everything else

Uses `globalThis.fetch` mocking (override `globalThis.fetch` in test setup).

#### [NEW] [packages/vaultify/\_\_tests\_\_/stream.test.js](file:///d:/Projects/Vaultify/packages/vaultify/__tests__/stream.test.js)
Tests for the SSE stream parser:
- ✅ Parses `data:` lines into event objects
- ✅ Handles `event:` + `data:` pairs
- ✅ Skips empty lines and comments
- ✅ Handles `[DONE]` sentinel

---

### Phase 5 — Packaging (SDK)

Already covered in the `package.json` scaffold above. Key fields:
- `private: false`
- `files` array limits what gets published
- `exports` field for ESM-aware bundlers
- No `devDependencies` in the published package

---

### Phase 6 — CLI Publish Prep

#### [MODIFY] [apps/cli/package.json](file:///d:/Projects/Vaultify/apps/cli/package.json)
- Set `"private": false`
- Keep `"name": "@vaultify/cli"` (already set)
- Verify `"bin": { "vaultify": "./src/index.js" }` (already set)
- Verify `"engines": { "node": ">=18" }` (already set)
- Verify `"files": ["src/"]` (already set)
- Add `"keywords"`, `"license"`, `"repository"`, `"homepage"` fields
- Pin dependency versions (remove `^` prefixes)

#### [NEW] [apps/cli/README.md](file:///d:/Projects/Vaultify/apps/cli/README.md)
CLI readme with:
- Install: `npm install -g @vaultify/cli`
- Commands: `vaultify login`, `vaultify tokens create`, `vaultify tokens list`, `vaultify sync`, `vaultify audit`
- Configuration reference (`~/.vaultify/config.json`)
- Link to main project README

---

### Phase 7 — Docs & Security

#### [NEW] [docs/PUBLISH.md](file:///d:/Projects/Vaultify/docs/PUBLISH.md)
Manual publish steps:
1. Ensure npm login
2. Version bump
3. `npm publish --access public` commands for both packages
4. Post-publish smoke test instructions

#### [NEW] [docs/SECURITY.md](file:///d:/Projects/Vaultify/docs/SECURITY.md)
Trust model explanation:
- Server holds real keys encrypted with AES-256-GCM
- SDK only transmits `vlt_` proxy tokens
- Proxy tokens are worthless without the vault server
- Token scoping (IP, endpoint, rate limit, expiry)

---

### Phase 8 — CI & Release Scripts

#### [NEW] [scripts/release.js](file:///d:/Projects/Vaultify/scripts/release.js)
Node script that:
1. Runs tests (`node --test packages/vaultify/__tests__/*.test.js`)
2. Checks for uncommitted changes
3. Prompts for version bump (patch/minor/major)
4. Updates `package.json` versions
5. Prints `npm publish` commands — does **not** auto-publish

#### [NEW] [.github/workflows/test.yml](file:///d:/Projects/Vaultify/.github/workflows/test.yml)
GitHub Actions workflow:
- Triggers on push/PR to main
- Runs `npm install` + `npm test` (SDK tests)
- Matrix: Node 18, 20, 22

#### [NEW] [.github/workflows/publish.yml](file:///d:/Projects/Vaultify/.github/workflows/publish.yml)
GitHub Actions workflow:
- Triggered manually (`workflow_dispatch`) or on GitHub Release
- Runs tests
- Publishes both packages to npm
- Gated by manual approval (environment protection rule)

---

### Phase 9 — Verification

No code changes — manual checklist steps documented in `docs/PUBLISH.md`.

---

## Verification Plan

### Automated Tests
```bash
# Run SDK unit tests (zero-dependency, uses node:test)
node --test packages/vaultify/__tests__/client.test.js
node --test packages/vaultify/__tests__/stream.test.js

# Verify the SDK package is valid
cd packages/vaultify && npm pack --dry-run

# Verify the CLI package is valid
cd apps/cli && npm pack --dry-run
```

### Manual Verification
1. `npm pack` both packages and install `.tgz` files in a scratch project
2. Write a sample script that calls `createClient()` and verify it constructs correct URLs
3. Confirm `npx @vaultify/cli --help` works from the packed tarball
4. Review `npm publish --dry-run` output for both packages to ensure no sensitive files leak

---

## Summary of All New/Modified Files

| Action | Path | Purpose |
|--------|------|---------|
| MODIFY | [package.json](file:///d:/Projects/Vaultify/package.json) | Rename root to `vaultify-monorepo` |
| NEW | `packages/vaultify/package.json` | SDK package manifest |
| NEW | `packages/vaultify/index.js` | SDK entry point |
| NEW | `packages/vaultify/lib/client.js` | Core VaultifyClient |
| NEW | `packages/vaultify/lib/errors.js` | VaultifyError class |
| NEW | `packages/vaultify/lib/stream.js` | SSE stream parser |
| NEW | `packages/vaultify/README.md` | SDK documentation |
| NEW | `packages/vaultify/LICENSE` | MIT license |
| NEW | `packages/vaultify/__tests__/client.test.js` | SDK unit tests |
| NEW | `packages/vaultify/__tests__/stream.test.js` | Stream parser tests |
| MODIFY | [apps/cli/package.json](file:///d:/Projects/Vaultify/apps/cli/package.json) | Make publishable |
| NEW | `apps/cli/README.md` | CLI documentation |
| NEW | `docs/PUBLISH.md` | Publish checklist |
| NEW | `docs/SECURITY.md` | Trust model docs |
| NEW | `scripts/release.js` | Release script |
| NEW | `.github/workflows/test.yml` | CI test workflow |
| NEW | `.github/workflows/publish.yml` | CI publish workflow |
