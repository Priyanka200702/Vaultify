const { Router } = require('express');
const { getDecryptedKey } = require('../vault/vault.service');

const router = Router();

function requireInternalApiKey(req, res, next) {
  const key = req.headers['x-internal-api-key'];
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected || key !== expected) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Invalid internal API key' });
  }
  next();
}

router.post('/internal/vault/decrypt/:keyId', requireInternalApiKey, async (req, res, next) => {
  try {
    const rawKey = await getDecryptedKey(req.params.keyId);
    res.json({ rawKey });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
