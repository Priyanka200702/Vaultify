/**
 * VaultifyError — custom error class for Vaultify SDK errors.
 *
 * Thrown when the proxy server returns a non-2xx response or when
 * the request fails entirely (network error, timeout, etc.).
 *
 * @property {number|null} status  — HTTP status code (null for network errors)
 * @property {string|null} code    — Machine-readable error code from the server (e.g. 'MISSING_TOKEN')
 * @property {object|null} body    — Full parsed response body from the server
 */
class VaultifyError extends Error {
  /**
   * @param {string} message       — Human-readable error message
   * @param {number|null} status   — HTTP status code
   * @param {string|null} code     — Error code from the server
   * @param {object|null} body     — Full response body
   */
  constructor(message, status = null, code = null, body = null) {
    super(message);
    this.name = 'VaultifyError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

module.exports = { VaultifyError };
