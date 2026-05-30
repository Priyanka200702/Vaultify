/**
 * Provider base URL map — used by the proxy engine to forward requests.
 */
const PROVIDER_URLS = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com',
  stripe: 'https://api.stripe.com',
  github: 'https://api.github.com',
};

/**
 * Provider auth header format.
 * Most use Authorization: Bearer, but some differ.
 */
const PROVIDER_AUTH_HEADERS = {
  anthropic: { header: 'x-api-key', prefix: '' },
  openai: { header: 'Authorization', prefix: 'Bearer ' },
  stripe: { header: 'Authorization', prefix: 'Bearer ' },
  github: { header: 'Authorization', prefix: 'Bearer ' },
};

/**
 * Known API key prefixes — used by CLI to auto-detect provider.
 * Covers 34+ providers.
 */
const KEY_PREFIXES = {
  // AI/ML
  'sk-ant-': 'anthropic',
  'sk-': 'openai',
  'gsk-': 'groq',
  'r8_': 'replicate',
  'hf_': 'huggingface',
  // Payments
  'sk_live_': 'stripe',
  'sk_test_': 'stripe',
  'rk_live_': 'stripe',
  'rk_test_': 'stripe',
  // Version Control
  'ghp_': 'github',
  'github_pat_': 'github',
  'glpat-': 'gitlab',
  // Cloud
  'AKIA': 'aws',
  'ya29.': 'gcp',
  // Communication
  'SG.': 'sendgrid',
  'AC': 'twilio',
  're_': 'resend',
  // Databases
  'sbp_': 'supabase',
  'pscale_': 'planetscale',
  // Analytics
  'vercel_': 'vercel',
  // Other
  'shpat_': 'shopify',
  'CFPAT-': 'contentful',
  'APCA': 'algolia',
  'pk.': 'mapbox',
  // OAuth tokens (longer format)
  'gho_': 'github',
  'github_oauth_': 'github',
};

/**
 * Cache TTL for decrypted keys (milliseconds).
 */
const KEY_CACHE_TTL = 60 * 1000; // 60 seconds

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
