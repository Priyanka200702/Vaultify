const { Router } = require('express');
const { getWorkspace, inviteMember, updateMemberRole, removeMember } = require('./workspace.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { requireRole } = require('@vaultify/auth');
const { requireScope } = require('../../middleware/requireScope');

const router = Router();

router.use(authMiddleware);

router.get('/', requireScope('workspace:read'), getWorkspace);
router.post('/invite', requireRole('owner'), inviteMember);
router.patch('/members/:memberId', requireRole('owner'), updateMemberRole);
router.delete('/members/:memberId', requireRole('owner'), removeMember);

module.exports = router;
