const { PROVIDER_URLS, PROVIDER_AUTH_HEADERS } = require('../../config/constants');

/**
 * Resolves a provider name to its base URL.
 * @param {string} provider - e.g. "anthropic", "openai"
 * @returns {string | null}
 */
function getProviderUrl(provider) {
  return PROVIDER_URLS[provider.toLowerCase()] || null;
}

/**
 * Gets the auth header config for a provider.
 * @param {string} provider
 * @returns {{ header: string, prefix: string }}
 */
function getAuthConfig(provider) {
  return PROVIDER_AUTH_HEADERS[provider.toLowerCase()] || { header: 'Authorization', prefix: 'Bearer ' };
}

/**
 * Builds the full target URL for a proxied request.
 * @param {string} provider - Provider name
 * @param {string} path - The remaining path after /proxy/:provider/
 * @returns {string | null}
 */
function buildTargetUrl(provider, path) {
  const baseUrl = getProviderUrl(provider);
  if (!baseUrl) return null;
  return `${baseUrl}/${path}`;
}

module.exports = { getProviderUrl, getAuthConfig, buildTargetUrl };
