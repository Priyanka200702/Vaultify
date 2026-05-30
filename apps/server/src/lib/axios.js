const axios = require('axios');

/**
 * Creates an axios instance configured for proxying requests.
 * No default baseURL — set per-request based on provider.
 */
const proxyClient = axios.create({
  timeout: 120000, // 2 minutes — LLM calls can be slow
  maxRedirects: 0,
  validateStatus: () => true, // Don't throw on non-2xx — we forward everything
});

module.exports = { proxyClient };
