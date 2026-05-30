/**
 * Vaultify SDK
 *
 * Route API calls through the Vaultify proxy server using secure proxy tokens.
 * Drop-in replacement for direct API calls — your real keys never leave the vault.
 *
 * @example
 * const { createClient } = require('vaultify');
 *
 * const client = createClient('vlt_prod_abc123', {
 *   baseUrl: 'https://proxy.vaultify.dev',
 * });
 *
 * // Anthropic-compatible
 * const response = await client.messages.create({
 *   model: 'claude-sonnet-4-20250514',
 *   max_tokens: 1024,
 *   messages: [{ role: 'user', content: 'Hello' }],
 * });
 *
 * // Streaming
 * const stream = await client.messages.create({
 *   model: 'claude-sonnet-4-20250514',
 *   max_tokens: 1024,
 *   messages: [{ role: 'user', content: 'Hello' }],
 *   stream: true,
 * });
 * for await (const event of stream) {
 *   process.stdout.write(event.delta?.text || '');
 * }
 *
 * // Generic request (any provider/path)
 * const result = await client.request('POST', '/proxy/openai/v1/chat/completions', {
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Hello' }],
 * });
 *
 * @module vaultify
 */

const { VaultifyClient, redactToken } = require('./lib/client');
const { VaultifyError } = require('./lib/errors');

/**
 * Create a Vaultify client.
 *
 * @param {string} proxyToken       — Vaultify proxy token (must start with `vlt_`)
 * @param {object} [opts]
 * @param {string} [opts.baseUrl]   — Proxy server URL (default: VAULTIFY_SERVER_URL env or https://proxy.vaultify.dev)
 * @param {string} [opts.provider]  — Default provider for convenience methods (default: 'anthropic')
 * @param {number} [opts.timeout]   — Request timeout in ms (default: 30000)
 * @returns {VaultifyClient}
 * @throws {VaultifyError} If the token format is invalid
 */
function createClient(proxyToken, opts = {}) {
  return new VaultifyClient(proxyToken, opts);
}

module.exports = { createClient, VaultifyClient, VaultifyError, redactToken };
