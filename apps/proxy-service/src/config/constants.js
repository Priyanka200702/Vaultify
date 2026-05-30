const PROVIDER_URLS = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com',
  stripe: 'https://api.stripe.com',
  github: 'https://api.github.com',
};

const PROVIDER_AUTH_HEADERS = {
  anthropic: { header: 'x-api-key', prefix: '' },
  openai: { header: 'Authorization', prefix: 'Bearer ' },
  stripe: { header: 'Authorization', prefix: 'Bearer ' },
  github: { header: 'Authorization', prefix: 'Bearer ' },
};

const KEY_CACHE_TTL = 5 * 1000;
const DEFAULT_TOKEN_EXPIRY = {
  production: null,
  preview: 7,
  development: 1,
};

module.exports = { PROVIDER_URLS, PROVIDER_AUTH_HEADERS, KEY_CACHE_TTL, DEFAULT_TOKEN_EXPIRY };
