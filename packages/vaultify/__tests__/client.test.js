const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { createClient, VaultifyError } = require('../index');

// ─────────────────────────── Fetch Mock Helpers ───────────────────────────

/** Store the original global fetch so we can restore it */
let originalFetch;

/**
 * Creates a mock fetch that captures the request and returns a canned response.
 * @param {number} status — HTTP status code
 * @param {object|string} body — Response body
 * @param {object} [headers] — Response headers
 * @returns {{ fetch: Function, calls: Array<{ url: string, init: object }> }}
 */
function mockFetch(status, body, headers = {}) {
  const calls = [];
  const responseHeaders = new Map(Object.entries({
    'content-type': 'application/json',
    ...headers,
  }));

  const fn = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: {
        get: (key) => responseHeaders.get(key.toLowerCase()) || null,
      },
      json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    };
  };

  return { fetch: fn, calls };
}

// ─────────────────────────── Tests ───────────────────────────

describe('createClient()', () => {
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.VAULTIFY_SERVER_URL;
  });

  // --- Token Validation ---

  it('throws on missing token', () => {
    assert.throws(
      () => createClient(),
      (err) => {
        assert(err instanceof VaultifyError);
        assert.equal(err.code, 'INVALID_TOKEN');
        return true;
      }
    );
  });

  it('throws on empty string token', () => {
    assert.throws(
      () => createClient(''),
      (err) => err instanceof VaultifyError && err.code === 'INVALID_TOKEN'
    );
  });

  it('throws on non-vlt_ token', () => {
    assert.throws(
      () => createClient('sk-ant-real-key'),
      (err) => {
        assert(err instanceof VaultifyError);
        assert.equal(err.code, 'INVALID_TOKEN');
        assert(err.message.includes('vlt_'));
        return true;
      }
    );
  });

  it('accepts valid vlt_ token', () => {
    const mock = mockFetch(200, {});
    globalThis.fetch = mock.fetch;

    const client = createClient('vlt_prod_abc123');
    assert(client);
    assert(typeof client.messages.create === 'function');
    assert(typeof client.request === 'function');
  });

  it('accepts various vlt_ token formats', () => {
    const mock = mockFetch(200, {});
    globalThis.fetch = mock.fetch;

    // Different environments
    assert(createClient('vlt_prod_abc123'));
    assert(createClient('vlt_dev_xyz789'));
    assert(createClient('vlt_prev_test'));
  });

  // --- Base URL Resolution ---

  it('uses opts.baseUrl when provided', async () => {
    const mock = mockFetch(200, { id: 'msg_123' });
    globalThis.fetch = mock.fetch;

    const client = createClient('vlt_prod_abc', { baseUrl: 'https://my-proxy.example.com' });
    await client.request('GET', '/health');

    assert.equal(mock.calls.length, 1);
    assert(mock.calls[0].url.startsWith('https://my-proxy.example.com'));
  });

  it('reads VAULTIFY_SERVER_URL env when no baseUrl given', async () => {
    process.env.VAULTIFY_SERVER_URL = 'https://env-proxy.example.com';
    const mock = mockFetch(200, { ok: true });
    globalThis.fetch = mock.fetch;

    const client = createClient('vlt_prod_abc');
    await client.request('GET', '/health');

    assert.equal(mock.calls.length, 1);
    assert(mock.calls[0].url.startsWith('https://env-proxy.example.com'));
  });

  it('falls back to default URL', async () => {
    const mock = mockFetch(200, { ok: true });
    globalThis.fetch = mock.fetch;

    const client = createClient('vlt_prod_abc');
    await client.request('GET', '/health');

    assert.equal(mock.calls.length, 1);
    assert(mock.calls[0].url.startsWith('https://proxy.vaultify.dev'));
  });

  it('strips trailing slashes from baseUrl', async () => {
    const mock = mockFetch(200, { ok: true });
    globalThis.fetch = mock.fetch;

    const client = createClient('vlt_prod_abc', { baseUrl: 'https://example.com///' });
    await client.request('GET', '/health');

    assert(mock.calls[0].url.startsWith('https://example.com/health'));
  });
});

// ─────────────────────────── request() ───────────────────────────

describe('client.request()', () => {
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends correct method, URL, headers, and body', async () => {
    const mock = mockFetch(200, { result: 'ok' });
    globalThis.fetch = mock.fetch;

    const client = createClient('vlt_prod_token123', { baseUrl: 'https://test.example.com' });
    await client.request('POST', '/proxy/anthropic/v1/messages', { model: 'claude-sonnet-4-20250514' });

    assert.equal(mock.calls.length, 1);
    const { url, init } = mock.calls[0];

    assert.equal(url, 'https://test.example.com/proxy/anthropic/v1/messages');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers['Authorization'], 'Bearer vlt_prod_token123');
    assert.equal(init.headers['Content-Type'], 'application/json');

    const body = JSON.parse(init.body);
    assert.equal(body.model, 'claude-sonnet-4-20250514');
  });

  it('normalizes paths without leading slash', async () => {
    const mock = mockFetch(200, { ok: true });
    globalThis.fetch = mock.fetch;

    const client = createClient('vlt_prod_abc', { baseUrl: 'https://test.com' });
    await client.request('GET', 'proxy/anthropic/v1/models');

    assert.equal(mock.calls[0].url, 'https://test.com/proxy/anthropic/v1/models');
  });

  it('does not send body for null', async () => {
    const mock = mockFetch(200, { ok: true });
    globalThis.fetch = mock.fetch;

    const client = createClient('vlt_prod_abc', { baseUrl: 'https://test.com' });
    await client.request('GET', '/health');

    assert.equal(mock.calls[0].init.body, undefined);
  });

  it('merges custom headers', async () => {
    const mock = mockFetch(200, { ok: true });
    globalThis.fetch = mock.fetch;

    const client = createClient('vlt_prod_abc', { baseUrl: 'https://test.com' });
    await client.request('POST', '/test', {}, { headers: { 'X-Custom': 'value' } });

    assert.equal(mock.calls[0].init.headers['X-Custom'], 'value');
    // Auth header should still be set
    assert.equal(mock.calls[0].init.headers['Authorization'], 'Bearer vlt_prod_abc');
  });

  // --- Error Handling ---

  it('throws VaultifyError on 4xx response', async () => {
    const mock = mockFetch(403, {
      error: 'TOKEN_EXPIRED',
      message: 'Proxy token has expired',
    });
    globalThis.fetch = mock.fetch;

    const client = createClient('vlt_prod_abc', { baseUrl: 'https://test.com' });

    await assert.rejects(
      () => client.request('POST', '/proxy/anthropic/v1/messages', {}),
      (err) => {
        assert(err instanceof VaultifyError);
        assert.equal(err.status, 403);
        assert.equal(err.code, 'TOKEN_EXPIRED');
        assert.equal(err.message, 'Proxy token has expired');
        assert.deepEqual(err.body, { error: 'TOKEN_EXPIRED', message: 'Proxy token has expired' });
        return true;
      }
    );
  });

  it('throws VaultifyError on 5xx response', async () => {
    const mock = mockFetch(502, {
      error: 'PROXY_FORWARD_FAILED',
      message: 'Failed to reach the provider API',
    });
    globalThis.fetch = mock.fetch;

    const client = createClient('vlt_prod_abc', { baseUrl: 'https://test.com' });

    await assert.rejects(
      () => client.request('POST', '/proxy/anthropic/v1/messages', {}),
      (err) => {
        assert(err instanceof VaultifyError);
        assert.equal(err.status, 502);
        assert.equal(err.code, 'PROXY_FORWARD_FAILED');
        return true;
      }
    );
  });

  it('throws VaultifyError on network error', async () => {
    globalThis.fetch = async () => { throw new Error('ECONNREFUSED'); };

    const client = createClient('vlt_prod_abc', { baseUrl: 'https://test.com' });

    await assert.rejects(
      () => client.request('GET', '/health'),
      (err) => {
        assert(err instanceof VaultifyError);
        assert.equal(err.code, 'NETWORK_ERROR');
        assert(err.message.includes('ECONNREFUSED'));
        return true;
      }
    );
  });

  it('throws VaultifyError on timeout', async () => {
    globalThis.fetch = async (url, init) => {
      // Simulate a request that takes too long
      return new Promise((_, reject) => {
        init.signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    };

    const client = createClient('vlt_prod_abc', { baseUrl: 'https://test.com', timeout: 50 });

    await assert.rejects(
      () => client.request('GET', '/health'),
      (err) => {
        assert(err instanceof VaultifyError);
        assert.equal(err.code, 'TIMEOUT');
        return true;
      }
    );
  });
});

// ─────────────────────────── messages.create() ───────────────────────────

describe('client.messages.create()', () => {
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('routes to /proxy/anthropic/v1/messages by default', async () => {
    const mock = mockFetch(200, {
      id: 'msg_abc123',
      type: 'message',
      content: [{ type: 'text', text: 'Hello!' }],
    });
    globalThis.fetch = mock.fetch;

    const client = createClient('vlt_prod_abc', { baseUrl: 'https://test.com' });
    const result = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Hi' }],
    });

    assert.equal(mock.calls[0].url, 'https://test.com/proxy/anthropic/v1/messages');
    assert.equal(result.id, 'msg_abc123');
  });

  it('sends the full payload as JSON body', async () => {
    const mock = mockFetch(200, { id: 'msg_123' });
    globalThis.fetch = mock.fetch;

    const payload = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        { role: 'user', content: 'What is 2+2?' },
      ],
      temperature: 0.7,
    };

    const client = createClient('vlt_prod_abc', { baseUrl: 'https://test.com' });
    await client.messages.create(payload);

    const sentBody = JSON.parse(mock.calls[0].init.body);
    assert.equal(sentBody.model, 'claude-sonnet-4-20250514');
    assert.equal(sentBody.max_tokens, 2048);
    assert.equal(sentBody.temperature, 0.7);
    assert.deepEqual(sentBody.messages, [{ role: 'user', content: 'What is 2+2?' }]);
  });

  it('throws for unsupported provider with no messages path', async () => {
    const mock = mockFetch(200, {});
    globalThis.fetch = mock.fetch;

    const client = createClient('vlt_prod_abc', {
      baseUrl: 'https://test.com',
      provider: 'stripe', // Stripe has no messages API
    });

    await assert.rejects(
      () => client.messages.create({ model: 'test' }),
      (err) => {
        assert(err instanceof VaultifyError);
        assert.equal(err.code, 'UNSUPPORTED_PROVIDER');
        return true;
      }
    );
  });

  it('uses custom provider when set', async () => {
    const mock = mockFetch(200, { id: 'chatcmpl-123' });
    globalThis.fetch = mock.fetch;

    // Note: openai doesn't have a 'messages' path in PROVIDER_PATHS,
    // so this should throw. This test verifies the provider is used.
    const client = createClient('vlt_prod_abc', {
      baseUrl: 'https://test.com',
      provider: 'openai',
    });

    await assert.rejects(
      () => client.messages.create({ model: 'gpt-4' }),
      (err) => err instanceof VaultifyError && err.code === 'UNSUPPORTED_PROVIDER'
    );
  });
});
