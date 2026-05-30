# Vaultify — Publish Roadmap (SDK + CLI)

Goal: publish two npm packages:
- `vaultify` (SDK) — developer runtime package. Exposes `createClient(proxyToken, opts)` that behaves like Anthropic/OpenAI SDK but routes calls to the Vaultify proxy server.
- `vaultify-cli` (CLI) — previously `apps/cli`, published as a CLI package with a `vaultify` bin.

---

## High-level phases

1. Design & naming (confirm names + defaults)
2. Scaffold packages (files + package.json)
3. Implement SDK (client wrapper + browser/node compatibility)
4. Tests (unit + integration mocks)
5. Packaging (exports, files, README)
6. CLI publish prep (ensure bin + deps)
7. Docs + security notes
8. CI & release scripts (no auto publish without approval)
9. Final verification & publish checklist

---

## Detailed checklist

### Phase 1 — Design
- [ ] Confirm npm names: `vaultify` (SDK) and `vaultify-cli` (or `@vaultify/cli`) — decide scoped vs unscoped.
- [ ] Confirm default proxy base URL (suggest: `https://proxy.vaultify.dev`) and env override name (`VAULTIFY_SERVER_URL`).
- [ ] Define SDK surface: `createClient(token, opts)` returns an object with at least `messages.create(payload)` and a generic `request(method, path, opts)`.

### Phase 2 — Scaffold packages
- [ ] Create `packages/vaultify/` with `package.json`, `index.js`, `README.md`, `LICENSE`.
- [ ] Add `apps/cli` adjustments (duplicate `package.json` to be publishable) or keep `packages/cli` wrapper that reuses `apps/cli/src`.
- [ ] Add `.npmignore` or `files` in `package.json` to include only runtime files.

### Phase 3 — Implement SDK
- [ ] `packages/vaultify/index.js` exports `createClient(proxyToken, { baseUrl })`.
- [ ] Implementation details:
  - Use `fetch` for browser; for Node, fallback to `node-fetch` or `undici` if required (keep dependencies minimal).
  - All requests must set `Authorization: Bearer <proxyToken>` and forward path to `${baseUrl}/proxy/<provider>/<...>` or to your server's API shape (decide mapping).
  - Provide minimal compatibility wrapper so code using Anthropic style `client.messages.create()` works with little/no changes.
  - Provide small `package.json` `exports` and `main` fields.
- [ ] Add JSDoc comments and runtime validation of token format (ensure startsWith `vlt_`).

### Phase 4 — Tests
- [ ] Unit tests with mocked HTTP server (Jest + nock or msw): ensure `createClient()` calls correct base URL and sets headers.
- [ ] Browser compatibility smoke test (optional): ensure bundling works with Vite.

### Phase 5 — Packaging
- [ ] Set `private: false`, `name`, `version`, `license`, `repository`, and `keywords`.
- [ ] Add `README.md` with install, quickstart, and security note (real key not stored in package).
- [ ] Add small CHANGELOG entry.

### Phase 6 — CLI publish prep
- [ ] Update `apps/cli/package.json`: `private: false`, `name: "vaultify-cli"` (or scoped), `bin: { "vaultify": "./src/index.js" }`.
- [ ] Ensure `engines.node` set and dependencies pinned.
- [ ] Add CLI README with examples: `npx vaultify login`, `npx vaultify tokens create`, `npx vaultify sync`.

### Phase 7 — Docs & Security
- [ ] `docs/PUBLISH.md` with manual publish steps and npm account notes.
- [ ] `docs/SECURITY.md` explaining the trust model (server holds real keys encrypted, package only uses vlt_ tokens).
- [ ] `README` examples showing migration from Anthropic: one-line change `import { createClient } from 'vaultify'`.

### Phase 8 — CI & release scripts
- [ ] Add `scripts/release` that runs tests, bumps versions, builds (if any), and prints publish commands (no auto publish without approval).
- [ ] Add `ci/` workflow example (GitHub Actions) for tests and optionally `publish` job gated by manual approval.

### Phase 9 — Final verification & publish checklist (manual steps)
- [ ] Confirm package names available on npm (no conflicts) — `npm search`/`npm view`.
- [ ] `npm login` as publishing account.
- [ ] Bump version in `package.json`.
- [ ] `npm publish --access public` (or `--access restricted` for scoped org package) — CLI must be public if using `npx`.
- [ ] Post-publish smoke checks:
  - `npm pack` and `npm i ./vaultify-<version>.tgz` in a sample project.
  - Run quick sample script showing `createClient()` usage working against staging proxy.

---

## Handoff notes
- I will prepare the scaffolding and implementation in `packages/vaultify/` and update CLI package.json but will NOT run `npm publish` without your account and consent.
- After scaffolding & tests, I'll provide exact `npm publish` commands and a `PUBLISH.md` checklist you can run locally.

---

If this looks good I will scaffold `packages/vaultify` and create the initial `index.js`, tests, and package.json. Reply `go` to start.