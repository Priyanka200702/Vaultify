const { Router } = require('express');
const { issueToken, listTokens, getToken, revokeToken } = require('./token.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

const router = Router();

router.use(authMiddleware);

router.post('/', issueToken);
router.get('/', listTokens);
router.get('/:id', getToken);
router.delete('/:id', revokeToken);

module.exports = router;
