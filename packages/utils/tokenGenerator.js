const crypto = require('crypto');
const { registry } = require('./providerRegistry');

// Base58 alphabet — no 0, O, I, l (avoids ambiguous characters)
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Encodes a Buffer to base58 string.
 * @param {Buffer} buffer
 * @returns {string}
 */
function toBase58(buffer) {
  let result = '';
  let num = BigInt('0x' + buffer.toString('hex'));
  const base = BigInt(58);

  while (num > 0n) {
    const remainder = Number(num % base);
    result = BASE58_ALPHABET[remainder] + result;
    num = num / base;
  }

  // Preserve leading zeros
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
    result = BASE58_ALPHABET[0] + result;
  }

  return result;
}

const VAULTIFY_ENV_SEGMENTS = ['prod', 'prev', 'dev'];

/**
 * Generates a Vaultify proxy token.
 * Format: vlt_{env}_{32 random bytes in base58}
 *
 * @param {'prod' | 'prev' | 'dev'} env - The environment segment.
 * @returns {string} The generated proxy token.
 */
function generateProxyToken(env = 'prod') {
  if (!VAULTIFY_ENV_SEGMENTS.includes(env)) {
    throw new Error(`Invalid environment: ${env}. Must be one of: ${VAULTIFY_ENV_SEGMENTS.join(', ')}`);
  }

  const randomBytes = crypto.randomBytes(32);
  const randomPart = toBase58(randomBytes);

  return `vlt_${env}_${randomPart}`;
}

/**
 * Build a lookup of every provider prefix mapped to the vaultified variant.
 * e.g., 'sk-' -> 'sk-vlt-', 'sk-ant-' -> 'sk-ant-vlt-'
 * Uses the first keyPrefix from each provider entry.
 */
let vaultPrefixMap = null;

function buildVaultPrefixMap() {
  if (vaultPrefixMap) return vaultPrefixMap;
  vaultPrefixMap = {};
  for (const [, config] of Object.entries(registry)) {
    for (const prefix of config.keyPrefixes) {
      // Strip trailing non-alphanum, add '-vlt-' separator
      const clean = prefix.replace(/[^a-zA-Z0-9]$/, '');
      vaultPrefixMap[`${clean}-vlt-`] = { providerPrefix: prefix, cleanBase: clean };
    }
  }
  return vaultPrefixMap;
}

const CANONICAL_RE = /^vlt_(prod|prev|dev)_[1-9A-HJ-NP-Za-km-z]{20,}$/;

/**
 * Validates that a string matches the proxy token format.
 * Accepts both canonical vlt_ tokens and provider-prefixed variants (e.g., sk-vlt-prod_...).
 * @param {string} token
 * @returns {boolean}
 */
function validateTokenFormat(token) {
  if (!token || typeof token !== 'string') return false;

  if (CANONICAL_RE.test(token)) return true;

  // Check if it matches a provider-prefixed format
  const map = buildVaultPrefixMap();
  for (const vaultPrefix of Object.keys(map)) {
    if (token.startsWith(vaultPrefix)) {
      const remainder = token.slice(vaultPrefix.length);
      // Should match vlt_{env}_{base58} after stripping provider prefix + separator
      // e.g., sk-vlt-prod_abc123 -> strip 'sk-vlt-' -> 'prod_abc123'
      if (VAULTIFY_ENV_SEGMENTS.some(seg => remainder.startsWith(seg))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Extracts the canonical vlt_ token from any valid format.
 * e.g., 'sk-vlt-prod_abc' -> 'vlt_prod_abc'
 *        'vlt_prod_abc'   -> 'vlt_prod_abc'
 * @param {string} token
 * @returns {string | null}
 */
function extractCanonicalToken(token) {
  if (!token || typeof token !== 'string') return null;

  if (CANONICAL_RE.test(token)) return token;

  const map = buildVaultPrefixMap();
  for (const vaultPrefix of Object.keys(map)) {
    if (token.startsWith(vaultPrefix)) {
      const envSeg = token.slice(vaultPrefix.length);
      return `vlt_${envSeg}`;
    }
  }

  return null;
}

/**
 * Generates a provider-prefixed proxy token for SDK compatibility.
 * e.g., for OpenAI: 'sk-vlt-prod_<base58>' (SDK sees sk- prefix and accepts it)
 * @param {string} provider - Provider key from registry (e.g., 'openai', 'anthropic')
 * @param {'prod' | 'prev' | 'dev'} env - Environment
 * @returns {string}
 */
function generateProxyTokenForProvider(provider, env = 'prod') {
  const canonical = generateProxyToken(env);
  const config = registry[provider];
  if (!config) return canonical;

  const prefix = config.keyPrefixes[0];
  if (!prefix) return canonical;

  const clean = prefix.replace(/[^a-zA-Z0-9]$/, '');
  // canonical is 'vlt_prod_abc' -> we need 'sk-vlt-prod_abc'
  // strip 'vlt_' prefix, keep the rest
  const rest = canonical.slice(4); // 'prod_abc'
  return `${clean}-vlt-${rest}`;
}

/**
 * Extracts the environment from a proxy token string.
 * @param {string} token
 * @returns {string | null}
 */
function extractTokenEnv(token) {
  const canonical = extractCanonicalToken(token);
  if (!canonical) return null;
  const parts = canonical.split('_');
  return parts[1] || null;
}

module.exports = { generateProxyToken, generateProxyTokenForProvider, validateTokenFormat, extractTokenEnv, extractCanonicalToken, toBase58 };
