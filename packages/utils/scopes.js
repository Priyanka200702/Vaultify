const SCOPES = Object.freeze({
  PROXY_READ: 'proxy:read',
  PROXY_WRITE: 'proxy:write',
  PROXY_ADMIN: 'proxy:admin',
  TOKENS_READ: 'tokens:read',
  TOKENS_WRITE: 'tokens:write',
  AUDIT_READ: 'audit:read',
  WORKSPACE_READ: 'workspace:read',
  WORKSPACE_WRITE: 'workspace:write',
});

const SCOPE_DESCRIPTIONS = Object.freeze({
  [SCOPES.PROXY_READ]: 'Forward read-only requests (GET) through the proxy',
  [SCOPES.PROXY_WRITE]: 'Forward write requests (POST, PUT, PATCH, DELETE) through the proxy',
  [SCOPES.PROXY_ADMIN]: 'Forward any request through the proxy (includes proxy:read + proxy:write)',
  [SCOPES.TOKENS_READ]: 'List and view proxy tokens',
  [SCOPES.TOKENS_WRITE]: 'Create and revoke proxy tokens',
  [SCOPES.AUDIT_READ]: 'View audit logs',
  [SCOPES.WORKSPACE_READ]: 'View workspace settings',
  [SCOPES.WORKSPACE_WRITE]: 'Update workspace settings',
});

const SCOPE_METHOD_MAP = Object.freeze({
  [SCOPES.PROXY_READ]: ['GET', 'HEAD', 'OPTIONS'],
  [SCOPES.PROXY_WRITE]: ['POST', 'PUT', 'PATCH', 'DELETE'],
  [SCOPES.PROXY_ADMIN]: ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'],
});

const DEFAULT_SCOPE_SET = [SCOPES.PROXY_ADMIN];

const SCOPE_HIERARCHY = Object.freeze({
  [SCOPES.PROXY_ADMIN]: [SCOPES.PROXY_READ, SCOPES.PROXY_WRITE],
});

// Endpoint → scope overrides for resource-aware access control.
// Keys are regex patterns matched against "METHOD /path" (case-insensitive).
// Order matters — first match wins. More specific patterns go first.
const ENDPOINT_SCOPE_MAP = [
  // ─── Sensitive / Admin operations → proxy:admin ───
  // Billing & usage — these should never be accessible with just proxy:write
  { pattern: /^(get|post|put|patch|delete)\s+\/v\d+\/billing\//i, scope: SCOPES.PROXY_ADMIN },
  { pattern: /^(get|post|put|patch|delete)\s+\/v\d+\/usage/i, scope: SCOPES.PROXY_ADMIN },
  { pattern: /^(get|post|put|patch|delete)\s+\/v\d+\/costs/i, scope: SCOPES.PROXY_ADMIN },
  { pattern: /^(get|post|put|patch|delete)\s+\/v\d+\/organization\//i, scope: SCOPES.PROXY_ADMIN },
  { pattern: /^(get|post|put|patch|delete)\s+\/v\d+\/account\//i, scope: SCOPES.PROXY_ADMIN },
  // Stripe-specific sensitive endpoints
  { pattern: /^post\s+\/v\d+\/charges/i, scope: SCOPES.PROXY_ADMIN },
  { pattern: /^post\s+\/v\d+\/refunds/i, scope: SCOPES.PROXY_ADMIN },
  { pattern: /^post\s+\/v\d+\/payouts/i, scope: SCOPES.PROXY_ADMIN },
  { pattern: /^post\s+\/v\d+\/transfers/i, scope: SCOPES.PROXY_ADMIN },
  { pattern: /^(post|delete)\s+\/v\d+\/customers/i, scope: SCOPES.PROXY_ADMIN },
  { pattern: /^(post|delete)\s+\/v\d+\/subscriptions/i, scope: SCOPES.PROXY_ADMIN },
  // Key/secret management
  { pattern: /^(post|delete)\s+\/v\d+\/api-?keys/i, scope: SCOPES.PROXY_ADMIN },
  { pattern: /^(post|delete)\s+\/v\d+\/secrets/i, scope: SCOPES.PROXY_ADMIN },
  // Destructive operations — DELETE on any resource needs admin
  { pattern: /^delete\s+\/v\d+\/fine-tuning\//i, scope: SCOPES.PROXY_ADMIN },
  { pattern: /^delete\s+\/v\d+\/files\//i, scope: SCOPES.PROXY_ADMIN },
  { pattern: /^delete\s+\/v\d+\/assistants\//i, scope: SCOPES.PROXY_ADMIN },
  { pattern: /^delete\s+\/v\d+\/vector-stores\//i, scope: SCOPES.PROXY_ADMIN },
  { pattern: /^delete\s+\/v\d+\/threads\//i, scope: SCOPES.PROXY_ADMIN },
  // GitHub repo/org admin
  { pattern: /^(put|patch|delete)\s+\/repos\/[^/]+\/[^/]+$/i, scope: SCOPES.PROXY_ADMIN },
  { pattern: /^(post|put|patch|delete)\s+\/orgs\//i, scope: SCOPES.PROXY_ADMIN },

  // ─── Normal AI write operations → proxy:write ───
  { pattern: /^post\s+\/v\d+\/chat\/completions/i, scope: SCOPES.PROXY_WRITE },
  { pattern: /^post\s+\/v\d+\/messages/i, scope: SCOPES.PROXY_WRITE },
  { pattern: /^post\s+\/v\d+\/completions/i, scope: SCOPES.PROXY_WRITE },
  { pattern: /^post\s+\/v\d+\/embeddings/i, scope: SCOPES.PROXY_WRITE },
  { pattern: /^post\s+\/v\d+\/images\//i, scope: SCOPES.PROXY_WRITE },
  { pattern: /^post\s+\/v\d+\/audio\//i, scope: SCOPES.PROXY_WRITE },
  { pattern: /^post\s+\/v\d+\/moderations/i, scope: SCOPES.PROXY_WRITE },
  { pattern: /^post\s+\/v\d+\/fine-tuning\//i, scope: SCOPES.PROXY_WRITE },
  { pattern: /^post\s+\/v\d+\/batches/i, scope: SCOPES.PROXY_WRITE },
  { pattern: /^post\s+\/v\d+\/vector-stores\//i, scope: SCOPES.PROXY_WRITE },
  { pattern: /^post\s+\/v\d+\/assistants\//i, scope: SCOPES.PROXY_WRITE },
  { pattern: /^post\s+\/v\d+\/threads\//i, scope: SCOPES.PROXY_WRITE },
  { pattern: /^post\s+\/v\d+\/files/i, scope: SCOPES.PROXY_WRITE },
  // GitHub PR/issue creation
  { pattern: /^post\s+\/repos\/[^/]+\/[^/]+\/(issues|pulls|comments)/i, scope: SCOPES.PROXY_WRITE },

  // ─── Read operations → proxy:read ───
  { pattern: /^get\s+\/v\d+\/models/i, scope: SCOPES.PROXY_READ },
  { pattern: /^get\s+\/v\d+\/files/i, scope: SCOPES.PROXY_READ },
  { pattern: /^get\s+\/v\d+\/fine-tuning\//i, scope: SCOPES.PROXY_READ },
  { pattern: /^get\s+\/v\d+\/assistants/i, scope: SCOPES.PROXY_READ },
  { pattern: /^get\s+\/v\d+\/threads/i, scope: SCOPES.PROXY_READ },
  { pattern: /^get\s+\/v\d+\/vector-stores/i, scope: SCOPES.PROXY_READ },
  { pattern: /^get\s+\/v\d+\/batches/i, scope: SCOPES.PROXY_READ },
  { pattern: /^get\s+\/repos\//i, scope: SCOPES.PROXY_READ },
  { pattern: /^get\s+\/user/i, scope: SCOPES.PROXY_READ },

  // ─── Catch-all fallbacks by HTTP verb ───
  { pattern: /^(get|head|options)\s+/, scope: SCOPES.PROXY_READ },
  { pattern: /^post\s+/, scope: SCOPES.PROXY_WRITE },
  { pattern: /^put\s+/, scope: SCOPES.PROXY_WRITE },
  { pattern: /^patch\s+/, scope: SCOPES.PROXY_WRITE },
  { pattern: /^delete\s+/, scope: SCOPES.PROXY_ADMIN },
];

function checkScope(tokenScopes, requiredScope) {
  if (!tokenScopes || tokenScopes.length === 0) return true;
  if (tokenScopes.includes('*')) return true;
  if (tokenScopes.includes(requiredScope)) return true;
  for (const scope of tokenScopes) {
    const children = SCOPE_HIERARCHY[scope];
    if (children && children.includes(requiredScope)) return true;
  }
  return false;
}

function methodToScope(method) {
  const upper = method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(upper)) return SCOPES.PROXY_READ;
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(upper)) return SCOPES.PROXY_WRITE;
  return SCOPES.PROXY_ADMIN;
}

/**
 * Determines the required scope for an endpoint string "METHOD /path".
 * Checks resource-specific overrides first, then falls back to method-based mapping.
 * @param {string} endpoint - e.g. "POST /v1/chat/completions" or "GET /v1/models"
 * @returns {string} The required scope
 */
function endpointToScope(endpoint) {
  if (!endpoint || typeof endpoint !== 'string') return SCOPES.PROXY_ADMIN;
  for (const { pattern, scope } of ENDPOINT_SCOPE_MAP) {
    if (pattern.test(endpoint)) return scope;
  }
  const method = endpoint.split(' ')[0] || 'GET';
  return methodToScope(method);
}

module.exports = { SCOPES, SCOPE_DESCRIPTIONS, SCOPE_METHOD_MAP, DEFAULT_SCOPE_SET, checkScope, methodToScope, endpointToScope };
