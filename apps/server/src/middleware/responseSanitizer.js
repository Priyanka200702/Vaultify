const ALLOWED_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'cache-control',
  'expires',
  'pragma',
  'retry-after',
  'x-request-id',
  'x-correlation-id',
  'x-ratelimit-remaining',
  'x-ratelimit-limit',
  'x-ratelimit-reset',
];

const STRIPPED_HEADER_PATTERNS = [
  /^set-cookie$/i,
  /^x-amz-/i,
  /^x-azure-/i,
  /^x-ms-/i,
  /^x-gcs-/i,
  /^x-cloud-/i,
  /^x-robots-/i,
  /^x-frame-options$/i,
  /^x-xss-protection$/i,
  /^access-control-/i,
  /^strict-transport-security$/i,
  /^server$/i,
  /^via$/i,
  /^x-powered-by$/i,
  /^x-varnish$/i,
  /^cf-/i,
  /^x-served-by$/i,
  /^x-timer$/i,
  /^x-runtime$/i,
];

function isHeaderAllowed(name) {
  const lower = name.toLowerCase();
  if (ALLOWED_RESPONSE_HEADERS.includes(lower)) return true;
  for (const pattern of STRIPPED_HEADER_PATTERNS) {
    if (pattern.test(name)) return false;
  }
  return true;
}

function sanitizeHeaders(headers) {
  const sanitized = {};
  if (!headers || typeof headers !== 'object') return sanitized;
  for (const [key, value] of Object.entries(headers)) {
    if (isHeaderAllowed(key)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function sanitizeHeadersExpress(source, target) {
  for (const [key, value] of Object.entries(source)) {
    if (isHeaderAllowed(key) &&
        !['transfer-encoding', 'connection', 'content-encoding'].includes(key.toLowerCase())) {
      target.setHeader(key, value);
    }
  }
}

module.exports = { sanitizeHeaders, sanitizeHeadersExpress, isHeaderAllowed };
