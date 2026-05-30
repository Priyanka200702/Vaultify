const { generateProxyToken, generateProxyTokenForProvider, validateTokenFormat, extractTokenEnv, extractCanonicalToken } = require('./tokenGenerator');
const { ipInRange, ipAllowed, ipToNumber } = require('./ipValidator');
const { rollingWindowCount } = require('./rateLimiter');
const { SCOPES, SCOPE_DESCRIPTIONS, SCOPE_METHOD_MAP, DEFAULT_SCOPE_SET, checkScope, methodToScope } = require('./scopes');
const { createConfig, VALIDATORS } = require('./envParser');
const { registry, getProvider, detectProvider, getBaseUrl, getAuthConfig, getApiPath, listProviders } = require('./providerRegistry');
const { createMTlsClient, createInternalClient } = require('./mtlsClient');

module.exports = {
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
