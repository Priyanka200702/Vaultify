const { asyncHandler } = require('./asyncHandler');
const { generateProxyToken, generateProxyTokenForProvider, validateTokenFormat, extractTokenEnv, extractCanonicalToken } = require('./tokenGenerator');
const { ipInRange, ipAllowed, ipToNumber } = require('./ipValidator');
const { rollingWindowCount } = require('./rateLimiter');
const { SCOPES, SCOPE_DESCRIPTIONS, SCOPE_METHOD_MAP, DEFAULT_SCOPE_SET, checkScope, methodToScope, endpointToScope } = require('./scopes');
const { createConfig, VALIDATORS } = require('./envParser');
const { registry, getProvider, detectProvider, getBaseUrl, getAuthConfig, getApiPath, listProviders } = require('./providerRegistry');
const { createMTlsClient, createInternalClient } = require('./mtlsClient');

module.exports = {
  asyncHandler,
  generateProxyToken,
  generateProxyTokenForProvider,
  validateTokenFormat,
  extractTokenEnv,
  extractCanonicalToken,
  ipInRange,
  ipAllowed,
  ipToNumber,
  rollingWindowCount,
  SCOPES,
  SCOPE_DESCRIPTIONS,
  SCOPE_METHOD_MAP,
  DEFAULT_SCOPE_SET,
  checkScope,
  methodToScope,
  endpointToScope,
  createConfig,
  VALIDATORS,
  registry,
  getProvider,
  detectProvider,
  getBaseUrl,
  getAuthConfig,
  getApiPath,
  listProviders,
  createMTlsClient,
  createInternalClient,
};
