const { PROVIDER_URLS, PROVIDER_AUTH_HEADERS } = require('../../config/constants');

function getProviderUrl(provider) {
  return PROVIDER_URLS[provider.toLowerCase()] || null;
}

function getAuthConfig(provider) {
  return PROVIDER_AUTH_HEADERS[provider.toLowerCase()] || { header: 'Authorization', prefix: 'Bearer ' };
}

function buildTargetUrl(provider, path) {
  const baseUrl = getProviderUrl(provider);
  if (!baseUrl) return null;
  return `${baseUrl}/${path}`;
}

module.exports = { getProviderUrl, getAuthConfig, buildTargetUrl };
