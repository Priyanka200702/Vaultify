const { Router } = require('express');
const { storeKey, listKeys, rotateKey, deleteKey } = require('./vault.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

const router = Router();

// All vault routes require authentication
router.use(authMiddleware);

router.post('/keys', storeKey);
router.get('/keys', listKeys);
router.put('/keys/:id/rotate', rotateKey);
router.delete('/keys/:id', deleteKey);

module.exports = router;
