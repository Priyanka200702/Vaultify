const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

/**
 * Generates a new MFA secret for a user.
 */
function generateSecret(email) {
  return speakeasy.generateSecret({
    name: `Vaultify (${email})`,
    issuer: 'Vaultify',
  });
}

/**
 * Generates a QR code data URL for the MFA secret.
 */
async function generateQRCode(otpauthUrl) {
  try {
    return await QRCode.toDataURL(otpauthUrl);
  } catch (err) {
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Verifies a TOTP token against the secret.
 */
function verifyToken(token, secret) {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1, // Allow 1 step drift
  });
}

module.exports = { generateSecret, generateQRCode, verifyToken };
