const { VaultifyError } = require('./errors');
const { parseSSEStream } = require('./stream');

const DEFAULT_BASE_URL = 'https://proxy.vaultify.dev';
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;
const RETRYABLE_STATUSES = [429, 502, 503, 504];

const PROVIDER_PATHS = {
  anthropic: {
    messages: 'v1/messages',
  },
  openai: {
    chatCompletions: 'v1/chat/completions',
  },
};

const CSP_NOTICE = `
Content Security Policy (CSP) for browser usage:
- If using Vaultify SDK in a browser, add the proxy server to your CSP
- Example: connect-src 'self' https://proxy.vaultify.dev https://*.vaultify.dev
- Never include your vaultify proxy token in a page's CSP; it is an auth header, not a resource URL
- See https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP for CSP reference
`;

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

function redactToken(token) {
  if (!token || typeof token !== 'string') return '[REDACTED]';
  if (token.length <= 12) return token.slice(0, 4) + '****';
  return token.slice(0, 8) + '****' + token.slice(-4);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryable(err, status) {
  if (err?.code === 'NETWORK_ERROR' || err?.code === 'TIMEOUT') return true;
  return RETRYABLE_STATUSES.includes(status);
}

class VaultifyClient {
  constructor(proxyToken, opts = {}) {
    validateToken(proxyToken);

    this._token = proxyToken;
    this._baseUrl = (
      opts.baseUrl ||
      (typeof process !== 'undefined' && process.env && process.env.VAULTIFY_SERVER_URL) ||
      DEFAULT_BASE_URL
    ).replace(/\/+$/, '');

    this._provider = opts.provider || 'anthropic';
    this._timeout = opts.timeout || DEFAULT_TIMEOUT_MS;
    this._maxRetries = opts.maxRetries ?? MAX_RETRIES;

    this.messages = {
      create: (payload) => this._messagesCreate(payload),
    };
  }

  async request(method, path, body = null, opts = {}) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${this._baseUrl}${normalizedPath}`;

    const headers = {
      'Authorization': `Bearer ${this._token}`,
      'Content-Type': 'application/json',
      ...opts.headers,
    };

    const timeout = opts.timeout || this._timeout;
    const maxRetries = opts.maxRetries ?? this._maxRetries;

    let lastErr = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          method: method.toUpperCase(),
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

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

        if (!response.ok) {
          const errorBody = await this._parseErrorBody(response);

          if (attempt < maxRetries && isRetryable(null, response.status)) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000) + Math.random() * 500;
            await sleep(delay);
            continue;
          }

          throw new VaultifyError(
            errorBody.message || `HTTP ${response.status}: ${method} ${normalizedPath}`,
            response.status,
            errorBody.error || null,
            errorBody
          );
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          return response.json();
        }

        return response.text();
      } catch (err) {
        clearTimeout(timeoutId);

        if (err instanceof VaultifyError) throw err;

        if (err.name === 'AbortError') {
          if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000) + Math.random() * 500;
            await sleep(delay);
            lastErr = new VaultifyError(
              `Request timed out after ${timeout}ms: ${method} ${normalizedPath}`,
              null,
              'TIMEOUT'
            );
            continue;
          }
          throw new VaultifyError(
            `Request timed out after ${timeout}ms: ${method} ${normalizedPath}`,
            null,
            'TIMEOUT'
          );
        }

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000) + Math.random() * 500;
          await sleep(delay);
          lastErr = new VaultifyError(
            `Network error: ${err.message}`,
            null,
            'NETWORK_ERROR'
          );
          continue;
        }

        throw new VaultifyError(
          `Network error: ${err.message}`,
          null,
          'NETWORK_ERROR'
        );
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw lastErr || new VaultifyError('Request failed');
  }

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
      const response = await this.request('POST', path, payload, { stream: true });
      return parseSSEStream(response.body);
    }

    return this.request('POST', path, payload);
  }

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

module.exports = { VaultifyClient, validateToken, redactToken, CSP_NOTICE };
