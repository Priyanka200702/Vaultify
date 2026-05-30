# vaultify

> Route API calls through the Vaultify proxy using secure proxy tokens. Drop-in replacement for direct API calls — your real keys never leave the vault.

## Install

```bash
npm install vaultify
```

## Quick Start

```js
const { createClient } = require('vaultify');

const client = createClient('vlt_prod_abc123', {
  baseUrl: 'https://proxy.vaultify.dev', // your Vaultify server
});

// Anthropic-compatible: messages.create()
const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello, Claude!' }],
});

console.log(response.content[0].text);
```

## Streaming

```js
const stream = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Write a haiku' }],
  stream: true,
});

for await (const event of stream) {
  if (event.data?.delta?.text) {
    process.stdout.write(event.data.delta.text);
  }
}
```

## Migration from Anthropic SDK

The only change to your application code:

```diff
- const Anthropic = require('@anthropic-ai/sdk');
- const client = new Anthropic({
-   apiKey: process.env.ANTHROPIC_API_KEY,  // sk-ant-real-... stored in Vercel
- });
+ const { createClient } = require('vaultify');
+ const client = createClient(process.env.PROXY_TOKEN, {
+   baseUrl: process.env.VAULTIFY_SERVER_URL,
+ });

// Same API — no other changes needed
const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello' }],
});
```

## Generic Requests

For any provider or custom endpoint:

```js
// OpenAI through Vaultify proxy
const result = await client.request('POST', '/proxy/openai/v1/chat/completions', {
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello' }],
});

// Any custom path
const health = await client.request('GET', '/health');
```

## API Reference

### `createClient(proxyToken, options?)`

Creates a Vaultify client instance.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `proxyToken` | `string` | ✅ | Vaultify proxy token (must start with `vlt_`) |
| `options.baseUrl` | `string` | | Proxy server URL. Falls back to `VAULTIFY_SERVER_URL` env, then `https://proxy.vaultify.dev` |
| `options.provider` | `string` | | Default provider for convenience methods (default: `'anthropic'`) |
| `options.timeout` | `number` | | Request timeout in ms (default: `30000`) |

### `client.messages.create(payload)`

Anthropic-compatible message creation.

- Pass `stream: true` in the payload to receive an async iterable of SSE events.
- Routes to `/proxy/{provider}/v1/messages` automatically.

### `client.request(method, path, body?, options?)`

Generic request method for any provider or endpoint.

| Parameter | Type | Description |
|-----------|------|-------------|
| `method` | `string` | HTTP method (`GET`, `POST`, etc.) |
| `path` | `string` | Full path (e.g., `/proxy/openai/v1/chat/completions`) |
| `body` | `object` | Request body (JSON-serialized) |
| `options.headers` | `object` | Additional headers |
| `options.timeout` | `number` | Override timeout |
| `options.stream` | `boolean` | Return raw `Response` for manual stream handling |

### `VaultifyError`

Custom error class thrown on failures.

```js
const { VaultifyError } = require('vaultify');

try {
  await client.messages.create({ ... });
} catch (err) {
  if (err instanceof VaultifyError) {
    console.error(err.status);  // HTTP status code (e.g., 403)
    console.error(err.code);    // Error code (e.g., 'TOKEN_EXPIRED')
    console.error(err.body);    // Full response body
  }
}
```

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `VAULTIFY_SERVER_URL` | Default base URL for the proxy server (used when `baseUrl` option is not provided) |

## Security

- **Zero real keys in your codebase** — only `vlt_` proxy tokens are used.
- **Proxy tokens are worthless** without access to your Vaultify vault server.
- **Tokens are scoped** — limited to specific endpoints, IPs, rate limits, and expiry windows.
- **Zero dependencies** — no supply chain attack surface from transitive dependencies.

## Requirements

- Node.js 18+ (uses native `fetch`)
- A running [Vaultify vault server](https://github.com/vivaswanghosh/Vaultify)

## License

MIT © Vaultify Team
