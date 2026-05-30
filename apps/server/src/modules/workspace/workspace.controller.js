const workspaceService = require('./workspace.service');

async function getWorkspace(req, res, next) {
  try {
    const workspace = await workspaceService.getWorkspace(req.user.workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Workspace not found' });
    }
    res.json({ workspace });
  } catch (err) {
    next(err);
  }
}

async function inviteMember(req, res, next) {
  try {
    const { email, role } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'VALIDATION', message: 'Email is required' });
    }
    const workspace = await workspaceService.inviteMember(req.user.workspaceId, email, role);
    res.json({ message: 'Member invited', workspace });
  } catch (err) {
    if (err.message.includes('not found') || err.message.includes('already a member')) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: err.message });
    }
    next(err);
  }
}

async function updateMemberRole(req, res, next) {
  try {
    const { memberId } = req.params;
    const { role } = req.body;
    if (!role) {
      return res.status(400).json({ error: 'VALIDATION', message: 'Role is required' });
    }
    const workspace = await workspaceService.updateMemberRole(req.user.workspaceId, memberId, role);
    res.json({ message: 'Role updated', workspace });
  } catch (err) {
    next(err);
  }
}

async function removeMember(req, res, next) {
  try {
    const { memberId } = req.params;
    const workspace = await workspaceService.removeMember(req.user.workspaceId, memberId);
    res.json({ message: 'Member removed', workspace });
  } catch (err) {
    next(err);
  }
}

module.exports = { getWorkspace, inviteMember, updateMemberRole, removeMember };
