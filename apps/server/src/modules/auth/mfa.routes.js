const express = require('express');
const { requireAuth } = require('@vaultify/auth');
const mfaService = require('./mfa.service');
const { User } = require('@vaultify/db');

const router = express.Router();

/**
 * POST /api/auth/mfa/setup
 * Generates MFA secret and QR code for the authenticated user.
 */
router.post('/setup', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    }

    const secret = mfaService.generateSecret(user.email);
    const qrCode = await mfaService.generateQRCode(secret.otpauthURL());

    // Store secret temporarily (not enabled until verified)
    user.mfa.secret = secret.base32;
    await user.save();

    res.json({
      secret: secret.base32,
      qrCode,
      message: 'Scan the QR code with your authenticator app',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/mfa/verify
 * Verifies the TOTP token and enables MFA.
 */
router.post('/verify', requireAuth, async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'VALIDATION', message: 'Token is required' });
    }

    const user = await User.findById(req.user.userId);
    if (!user || !user.mfa.secret) {
      return res.status(400).json({ error: 'INVALID_STATE', message: 'MFA setup not initiated' });
    }

    const isValid = mfaService.verifyToken(token, user.mfa.secret);
    if (!isValid) {
      return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Invalid MFA token' });
    }

    user.mfa.enabled = true;
    await user.save();

    res.json({ message: 'MFA enabled successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/mfa/disable
 * Disables MFA for the authenticated user.
 */
router.post('/disable', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    }

    user.mfa.enabled = false;
    user.mfa.secret = null;
    await user.save();

    res.json({ message: 'MFA disabled successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
