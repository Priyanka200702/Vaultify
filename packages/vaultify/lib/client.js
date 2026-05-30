const { VaultifyError } = require('./errors');
const { parseSSEStream } = require('./stream');

/**
 * Default base URL for the Vaultify proxy server.
 * Can be overridden via `opts.baseUrl` or the `VAULTIFY_SERVER_URL` env var.
 */
const DEFAULT_BASE_URL = 'https://proxy.vaultify.dev';

/**
 * Default request timeout in milliseconds (30 seconds).
 */
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Provider-specific API path prefixes.
 * Used by convenience methods (e.g., `messages.create()`) to build the
 * correct proxy path: `/proxy/{provider}/{path}`.
 */
const PROVIDER_PATHS = {
  anthropic: {
    messages: 'v1/messages',
  },
  openai: {
    chatCompletions: 'v1/chat/completions',
  },
};

/**
 * Validates that a token has the expected `vlt_` prefix.
 *
 * @param {string} token — The proxy token to validate
 * @throws {VaultifyError} If the token format is invalid
 */
function validateToken(token) {
  if (!token || typeof token !== 'string') {
    throw new VaultifyError(
      'Proxy token is required. Pass a vlt_ token as the first argument to createClient().',
      null,
      'INVALID_TOKEN'
    );
  }

  if (!token.startsWith('vlt_')) {
    throw new VaultifyError(
      `Invalid proxy token format: token must start with "vlt_". Got: "${token.slice(0, 10)}..."`,
      null,
      'INVALID_TOKEN'
    );
  }
}

/**
 * VaultifyClient — core SDK client.
 *
 * Routes API calls through the Vaultify proxy server using a proxy token.
 * Provides both generic `request()` and provider-specific convenience methods.
 */
class VaultifyClient {
  /**
   * @param {string} proxyToken — Vaultify proxy token (must start with `vlt_`)
   * @param {object} [opts]
   * @param {string} [opts.baseUrl]   — Proxy server base URL (default: VAULTIFY_SERVER_URL env or https://proxy.vaultify.dev)
   * @param {string} [opts.provider]  — Default provider for convenience methods (default: 'anthropic')
   * @param {number} [opts.timeout]   — Request timeout in milliseconds (default: 30000)
   */
  constructor(proxyToken, opts = {}) {
    validateToken(proxyToken);

    this._token = proxyToken;
    this._baseUrl = (
      opts.baseUrl ||
      (typeof process !== 'undefined' && process.env && process.env.VAULTIFY_SERVER_URL) ||
      DEFAULT_BASE_URL
    ).replace(/\/+$/, ''); // Strip trailing slashes

    this._provider = opts.provider || 'anthropic';
    this._timeout = opts.timeout || DEFAULT_TIMEOUT_MS;

    // --- Convenience namespaces ---

    /**
     * Anthropic-compatible messages API.
     * @type {{ create: function(object): Promise<object|AsyncIterable> }}
     */
    this.messages = {
      /**
       * Create a message (Anthropic-compatible).
       *
       * @param {object} payload — Request body (model, messages, max_tokens, etc.)
       * @param {boolean} [payload.stream] — If true, returns an async iterable of SSE events
       * @returns {Promise<object|AsyncIterable<{ event: string|null, data: object }>>}
       */
      create: (payload) => this._messagesCreate(payload),
    };
  }

  // ─────────────────────────── Generic Request ───────────────────────────

  /**
   * Send a generic request through the Vaultify proxy.
   *
   * @param {string} method — HTTP method (GET, POST, PUT, DELETE, etc.)
   * @param {string} path   — Full path including `/proxy/{provider}/...`, or a relative path
   * @param {object} [body] — Request body (will be JSON-serialized)
   * @param {object} [opts]
   * @param {object} [opts.headers]  — Additional request headers
   * @param {number} [opts.timeout]  — Override default timeout
   * @param {boolean} [opts.stream]  — If true, returns raw Response for manual stream handling
   * @returns {Promise<object|Response>}
   * @throws {VaultifyError}
   */
  async request(method, path, body = null, opts = {}) {
    // Normalize path — ensure it starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${this._baseUrl}${normalizedPath}`;

    const headers = {
      'Authorization': `Bearer ${this._token}`,
      'Content-Type': 'application/json',
      ...opts.headers,
    };

    const timeout = opts.timeout || this._timeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let response;
    try {
      response = await fetch(url, {
        method: method.toUpperCase(),
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new VaultifyError(
          `Request timed out after ${timeout}ms: ${method} ${normalizedPath}`,
          null,
          'TIMEOUT'
        );
      }
      throw new VaultifyError(
        `Network error: ${err.message}`,
        null,
        'NETWORK_ERROR'
      );
    } finally {
      clearTimeout(timeoutId);
    }

    // If caller wants raw stream, return the response directly
    if (opts.stream) {
      if (!response.ok) {
        const errorBody = await this._parseErrorBody(response);
        throw new VaultifyError(
          errorBody.message || `HTTP ${response.status}`,
          response.status,
          errorBody.error || null,
          errorBody
        );
      }
      return response;
    }

    // Parse response
    if (!response.ok) {
      const errorBody = await this._parseErrorBody(response);
      throw new VaultifyError(
        errorBody.message || `HTTP ${response.status}: ${method} ${normalizedPath}`,
        response.status,
        errorBody.error || null,
        errorBody
      );
    }

    // Parse JSON response
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    }

    // Non-JSON — return as text
    return response.text();
  }

  // ─────────────────────────── Messages (Anthropic) ───────────────────────────

  /**
   * @private
   * Anthropic-compatible messages.create implementation.
   */
  async _messagesCreate(payload) {
    const provider = this._provider;
    const apiPath = PROVIDER_PATHS[provider]?.messages;

    if (!apiPath) {
      throw new VaultifyError(
        `No messages API path configured for provider "${provider}". Use client.request() for custom paths.`,
        null,
        'UNSUPPORTED_PROVIDER'
      );
    }

    const path = `/proxy/${provider}/${apiPath}`;
    const isStream = payload.stream === true;

    if (isStream) {
      // Return an async iterable of SSE events
      const response = await this.request('POST', path, payload, { stream: true });
      return parseSSEStream(response.body);
    }

    // Non-streaming — return parsed JSON
    return this.request('POST', path, payload);
  }

  // ─────────────────────────── Helpers ───────────────────────────

  /**
   * @private
   * Safely parse an error response body.
   */
  async _parseErrorBody(response) {
    try {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return await response.json();
      }
      const text = await response.text();
      return { message: text };
    } catch {
      return { message: `HTTP ${response.status}` };
    }
  }
}

module.exports = { VaultifyClient, validateToken };
