const registry = {
  anthropic: {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    auth: { header: 'x-api-key', prefix: '' },
    keyPrefixes: ['sk-ant-'],
    apiPaths: { messages: 'v1/messages' },
    docsUrl: 'https://docs.anthropic.com',
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    auth: { header: 'Authorization', prefix: 'Bearer ' },
    keyPrefixes: ['sk-'],
    apiPaths: { chatCompletions: 'v1/chat/completions' },
    docsUrl: 'https://platform.openai.com/docs',
  },
  stripe: {
    name: 'Stripe',
    baseUrl: 'https://api.stripe.com',
    auth: { header: 'Authorization', prefix: 'Bearer ' },
    keyPrefixes: ['sk_live_', 'sk_test_', 'rk_live_', 'rk_test_'],
    docsUrl: 'https://docs.stripe.com',
  },
  github: {
    name: 'GitHub',
    baseUrl: 'https://api.github.com',
    auth: { header: 'Authorization', prefix: 'Bearer ' },
    keyPrefixes: ['ghp_', 'github_pat_', 'gho_', 'github_oauth_'],
    docsUrl: 'https://docs.github.com/en/rest',
  },
  groq: {
    name: 'Groq',
    baseUrl: 'https://api.groq.com',
    auth: { header: 'Authorization', prefix: 'Bearer ' },
    keyPrefixes: ['gsk-'],
    docsUrl: 'https://console.groq.com/docs',
  },
  replicate: {
    name: 'Replicate',
    baseUrl: 'https://api.replicate.com',
    auth: { header: 'Authorization', prefix: 'Bearer ' },
    keyPrefixes: ['r8_'],
    docsUrl: 'https://replicate.com/docs',
  },
  huggingface: {
    name: 'Hugging Face',
    baseUrl: 'https://api-inference.huggingface.co',
    auth: { header: 'Authorization', prefix: 'Bearer ' },
    keyPrefixes: ['hf_'],
    docsUrl: 'https://huggingface.co/docs',
  },
  gitlab: {
    name: 'GitLab',
    baseUrl: 'https://gitlab.com/api/v4',
    auth: { header: 'Authorization', prefix: 'Bearer ' },
    keyPrefixes: ['glpat-'],
    docsUrl: 'https://docs.gitlab.com/ee/api',
  },
  aws: {
    name: 'AWS',
    baseUrl: null,
    auth: { header: 'Authorization', prefix: 'Bearer ' },
    keyPrefixes: ['AKIA'],
    docsUrl: 'https://docs.aws.amazon.com',
  },
  gcp: {
    name: 'Google Cloud',
    baseUrl: null,
    auth: { header: 'Authorization', prefix: 'Bearer ' },
    keyPrefixes: ['ya29.'],
    docsUrl: 'https://cloud.google.com/docs',
  },
  sendgrid: {
    name: 'SendGrid',
    baseUrl: 'https://api.sendgrid.com',
    auth: { header: 'Authorization', prefix: 'Bearer ' },
    keyPrefixes: ['SG.'],
    docsUrl: 'https://docs.sendgrid.com',
  },
  twilio: {
    name: 'Twilio',
    baseUrl: 'https://api.twilio.com',
    auth: { header: 'Authorization', prefix: 'Bearer ' },
    keyPrefixes: ['AC'],
    docsUrl: 'https://www.twilio.com/docs',
  },
  resend: {
    name: 'Resend',
    baseUrl: 'https://api.resend.com',
    auth: { header: 'Authorization', prefix: 'Bearer ' },
    keyPrefixes: ['re_'],
    docsUrl: 'https://resend.com/docs',
  },
  supabase: {
    name: 'Supabase',
    baseUrl: null,
    auth: { header: 'Authorization', prefix: 'Bearer ' },
    keyPrefixes: ['sbp_'],
    docsUrl: 'https://supabase.com/docs',
  },
  planetscale: {
    name: 'PlanetScale',
    baseUrl: 'https://api.planetscale.com',
    auth: { header: 'Authorization', prefix: 'Bearer ' },
    keyPrefixes: ['pscale_'],
    docsUrl: 'https://planetscale.com/docs',
  },
  vercel: {
    name: 'Vercel',
    baseUrl: 'https://api.vercel.com',
    auth: { header: 'Authorization', prefix: 'Bearer ' },
    keyPrefixes: ['vercel_'],
    docsUrl: 'https://vercel.com/docs',
  },
  shopify: {
    name: 'Shopify',
    baseUrl: null,
    auth: { header: 'X-Shopify-Access-Token', prefix: '' },
    keyPrefixes: ['shpat_'],
    docsUrl: 'https://shopify.dev/docs',
  },
  contentful: {
    name: 'Contentful',
    baseUrl: 'https://api.contentful.com',
    auth: { header: 'Authorization', prefix: 'Bearer ' },
    keyPrefixes: ['CFPAT-'],
    docsUrl: 'https://www.contentful.com/developers/docs',
  },
  algolia: {
    name: 'Algolia',
    baseUrl: null,
    auth: { header: 'Authorization', prefix: 'Bearer ' },
    keyPrefixes: ['APCA'],
    docsUrl: 'https://www.algolia.com/doc',
  },
  mapbox: {
    name: 'Mapbox',
    baseUrl: 'https://api.mapbox.com',
    auth: { header: 'Authorization', prefix: 'Bearer ' },
    keyPrefixes: ['pk.'],
    docsUrl: 'https://docs.mapbox.com',
  },
};

let prefixMap = null;

function buildPrefixMap() {
  if (prefixMap) return prefixMap;
  prefixMap = {};
  for (const [provider, config] of Object.entries(registry)) {
    for (const prefix of config.keyPrefixes) {
      prefixMap[prefix] = provider;
    }
  }
  return prefixMap;
}

function getProvider(name) {
  return registry[name] || null;
}

function detectProvider(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') return null;
  const map = buildPrefixMap();
  for (const [prefix, provider] of Object.entries(map)) {
    if (apiKey.startsWith(prefix)) return provider;
  }
  return null;
}

function getBaseUrl(name) {
  return registry[name]?.baseUrl || null;
}

function getAuthConfig(name) {
  return registry[name]?.auth || { header: 'Authorization', prefix: 'Bearer ' };
}

function getApiPath(name, pathName) {
  return registry[name]?.apiPaths?.[pathName] || null;
}

function listProviders() {
  return Object.keys(registry);
}

module.exports = {
  registry,
  getProvider,
  detectProvider,
  getBaseUrl,
  getAuthConfig,
  getApiPath,
  listProviders,
};
