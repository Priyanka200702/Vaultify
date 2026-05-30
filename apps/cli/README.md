# @vaultify/cli

> Vaultify CLI — secure API key management and proxy token syncing for Vercel deployments.

Replace real API keys with Vaultify proxy tokens on your deployment platform. Real keys stay encrypted in your Vaultify vault — deployment platforms only see worthless `vlt_` tokens.

## Install

```bash
# Global install
npm install -g @vaultify/cli

# Or use directly with npx
npx @vaultify/cli <command>
```

## Quick Start

```bash
# 1. Authenticate with your Vaultify server
vaultify login

# 2. Create a proxy token for your API key
vaultify tokens create

# 3. Push proxy tokens to Vercel environment variables
vaultify sync
```

## Commands

### `vaultify login`

Authenticate with your Vaultify vault server. Saves credentials to `~/.vaultify/config.json`.

```bash
vaultify login
```

### `vaultify tokens list`

List all active proxy tokens in your workspace.

```bash
vaultify tokens list
```

### `vaultify tokens create`

Interactively generate a new proxy token. Prompts for:
- Provider (Anthropic, OpenAI, Stripe, etc.)
- Environment (production, preview, development)
- Scope restrictions (endpoints, IPs, rate limits)
- Expiry window

```bash
vaultify tokens create
```

### `vaultify tokens revoke <id>`

Immediately revoke a proxy token. The token stops working within seconds.

```bash
vaultify tokens revoke tok_abc123
```

### `vaultify sync`

Push proxy tokens from your `.env.vaultify` file to Vercel environment variables. Replaces real keys with safe proxy tokens.

```bash
vaultify sync
```

### `vaultify status`

Check vault connection health, active token count, and any anomaly alerts.

```bash
vaultify status
```

### `vaultify env list`

View what environment variables Vercel currently has set for your project.

```bash
vaultify env list
```

### `vaultify audit`

View recent audit log entries showing all proxied API calls.

```bash
vaultify audit
vaultify audit --limit 50
```

## Configuration

After running `vaultify login`, credentials are stored at:

```
~/.vaultify/config.json
```

```json
{
  "serverUrl": "https://your-vault-server.example.com",
  "authToken": "eyJhbG..."
}
```

You can also set the server URL via environment variable:

```bash
export VAULTIFY_SERVER_URL=https://your-vault-server.example.com
```

## Security

- **No real keys leave the vault** — only `vlt_` proxy tokens are synced to Vercel.
- **Proxy tokens are scoped** — locked to specific endpoints, IPs, rate limits, and expiry.
- **Credentials stored locally** — your auth token is saved in `~/.vaultify/config.json`, not in your project.

## Requirements

- Node.js 18+
- A running Vaultify vault server

## License

MIT © Vaultify Team

---

Part of the [Vaultify](https://github.com/your-org/vaultify) project.
