/**
 * Checks whether an IP address falls within a CIDR range.
 * Supports IPv4 only (sufficient for hackathon).
 *
 * @param {string} ip - The IP address to check (e.g. "192.168.1.100").
 * @param {string} cidr - The CIDR range (e.g. "192.168.1.0/24").
 * @returns {boolean}
 */
function ipInRange(ip, cidr) {
  if (!ip || !cidr) return false;

  // If cidr is a plain IP, exact match
  if (!cidr.includes('/')) {
    return ip === cidr;
  }

  const [rangeIp, prefixStr] = cidr.split('/');
  const prefix = parseInt(prefixStr, 10);

  if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;

  const ipNum = ipToNumber(ip);
  const rangeNum = ipToNumber(rangeIp);

  if (ipNum === null || rangeNum === null) return false;

  // Create mask: e.g. prefix 24 → 0xFFFFFF00
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;

  return (ipNum & mask) === (rangeNum & mask);
}

/**
 * Converts an IPv4 address string to a 32-bit unsigned integer.
 * @param {string} ip
 * @returns {number | null}
 */
function ipToNumber(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;

  let num = 0;
  for (let i = 0; i < 4; i++) {
    const octet = parseInt(parts[i], 10);
    if (isNaN(octet) || octet < 0 || octet > 255) return null;
    num = (num * 256) + octet;
  }

  return num >>> 0; // Ensure unsigned
}

/**
 * Checks if an IP is allowed by any of the given CIDR ranges.
 * @param {string} ip
 * @param {string[]} allowedRanges
 * @returns {boolean}
 */
function ipAllowed(ip, allowedRanges) {
  if (!allowedRanges || allowedRanges.length === 0) return true; // No restriction
  return allowedRanges.some((cidr) => ipInRange(ip, cidr));
}

module.exports = { ipInRange, ipAllowed, ipToNumber };
