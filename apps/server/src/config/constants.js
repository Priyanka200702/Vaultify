const { registry, getBaseUrl, getAuthConfig } = require('@vaultify/utils');

/**
 * Provider base URL map — built from the provider registry.
 */
const PROVIDER_URLS = Object.fromEntries(
  Object.entries(registry).map(([k, v]) => [k, v.baseUrl]).filter(([, v]) => v !== null)
);

/**
 * Provider auth header format — built from the provider registry.
 */
const PROVIDER_AUTH_HEADERS = Object.fromEntries(
  Object.entries(registry).map(([k, v]) => [k, v.auth])
);

/**
 * Known API key prefixes — built from the provider registry.
 */
const KEY_PREFIXES = Object.fromEntries(
  Object.entries(registry).flatMap(([provider, config]) =>
    config.keyPrefixes.map(prefix => [prefix, provider])
  )
);

/**
 * Cache TTL for decrypted keys (milliseconds).
 */
const KEY_CACHE_TTL = 5 * 1000; // 5 seconds — reduced from 60s to limit heap exposure

/**
 * Default rate limits per environment.
 */
const DEFAULT_RATE_LIMITS = {
  production: 10000,
  preview: 500,
  development: 100,
};

/**
 * Default token expiry per environment (in days, null = never).
 */
const DEFAULT_TOKEN_EXPIRY = {
  production: null,
  preview: 7,
  development: 1,
};

module.exports = {
  PROVIDER_URLS,
  PROVIDER_AUTH_HEADERS,
  KEY_PREFIXES,
  KEY_CACHE_TTL,
  DEFAULT_RATE_LIMITS,
  DEFAULT_TOKEN_EXPIRY,
};
