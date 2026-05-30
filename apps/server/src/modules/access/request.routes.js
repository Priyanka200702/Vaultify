const { Router } = require('express');
const { submitRequest, listRequests, approveRequest, denyRequest } = require('./request.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { requireRole } = require('@vaultify/auth');

const router = Router();

router.use(authMiddleware);

router.post('/', submitRequest);
router.get('/', listRequests);
router.patch('/:id/approve', requireRole('owner'), approveRequest);
router.patch('/:id/deny', requireRole('owner'), denyRequest);

module.exports = router;
