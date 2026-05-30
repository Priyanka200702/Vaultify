const { Router } = require('express');
const { issueToken, listTokens, getToken, revokeToken } = require('./token.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { requireScope } = require('../../middleware/requireScope');

const router = Router();

router.use(authMiddleware);

router.post('/', requireScope('tokens:write'), issueToken);
router.get('/', requireScope('tokens:read'), listTokens);
router.get('/:id', requireScope('tokens:read'), getToken);
router.delete('/:id', requireScope('tokens:write'), revokeToken);

module.exports = router;
