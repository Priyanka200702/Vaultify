# Publishing Vaultify Packages to npm

This document covers the manual steps to publish both npm packages.

## Packages

| Package | Path | npm Name | Access |
|---------|------|----------|--------|
| SDK | `packages/vaultify/` | `vaultify` | Public |
| CLI | `apps/cli/` | `@vaultify/cli` | Public |

---

## Prerequisites

1. **npm account** with publish access
2. **Node.js 18+** installed
3. All tests passing
4. No uncommitted changes

## Pre-Publish Checklist

### 1. Verify tests pass

```bash
# SDK tests
node --test packages/vaultify/__tests__/client.test.js packages/vaultify/__tests__/stream.test.js

# Verify no errors
echo "Tests passed: $?"
```

### 2. Check package contents (dry run)

```bash
# SDK — verify only intended files are included
cd packages/vaultify
npm pack --dry-run
cd ../..

# CLI — verify only intended files are included
cd apps/cli
npm pack --dry-run
cd ../..
```

Review the file list. Ensure no `.env`, `node_modules`, or test files are included.

### 3. Verify npm login

```bash
npm whoami
# Should print your npm username

# If not logged in:
npm login
```

### 4. Check name availability

```bash
npm view vaultify
# Should return 404 if name is available

npm view @vaultify/cli
# Should return 404 if name is available
```

---

## Publishing

### Bump version (if needed)

```bash
# SDK
cd packages/vaultify
npm version patch   # or: minor, major
cd ../..

# CLI
cd apps/cli
npm version patch   # or: minor, major
cd ../..
```

### Publish SDK

```bash
cd packages/vaultify
npm publish --access public
cd ../..
```

### Publish CLI

```bash
cd apps/cli
npm publish --access public
cd ../..
```

> **Note:** Scoped packages (`@vaultify/cli`) require `--access public` to be publicly installable via `npx`.

---

## Post-Publish Verification

### SDK smoke test

```bash
# Create temp directory
mkdir /tmp/vaultify-test && cd /tmp/vaultify-test
npm init -y
npm install vaultify

# Test import
node -e "
  const { createClient, VaultifyError } = require('vaultify');
  const client = createClient('vlt_test_abc123', { baseUrl: 'http://localhost:3001' });
  console.log('✅ SDK loaded successfully');
  console.log('  - createClient:', typeof createClient);
  console.log('  - VaultifyError:', typeof VaultifyError);
  console.log('  - messages.create:', typeof client.messages.create);
  console.log('  - request:', typeof client.request);
"
```

### CLI smoke test

```bash
npx @vaultify/cli --help
# Should print CLI help text

npx @vaultify/cli --version
# Should print version number
```

### Pack test (alternative to publishing)

If you want to test without publishing:

```bash
# Pack both
cd packages/vaultify && npm pack && cd ../..
cd apps/cli && npm pack && cd ../..

# Install from tarball
mkdir /tmp/vaultify-test && cd /tmp/vaultify-test
npm init -y
npm install ../../packages/vaultify/vaultify-0.1.0.tgz
npm install ../../apps/cli/vaultify-cli-0.1.0.tgz
```

---

## Versioning Strategy

We follow [Semantic Versioning](https://semver.org/):

- **Patch** (`0.1.x`): Bug fixes, documentation updates
- **Minor** (`0.x.0`): New features, backwards-compatible
- **Major** (`x.0.0`): Breaking API changes

Both packages start at `0.1.0` to signal early-stage development.

---

## Rollback

If a broken version is published:

```bash
# Unpublish within 72 hours
npm unpublish vaultify@<version>
npm unpublish @vaultify/cli@<version>

# Or deprecate (preferred for older versions)
npm deprecate vaultify@<version> "Critical bug — use <new-version>"
npm deprecate @vaultify/cli@<version> "Critical bug — use <new-version>"
```

---

## CI/CD

See `.github/workflows/publish.yml` for the automated publish workflow (manual trigger required).
