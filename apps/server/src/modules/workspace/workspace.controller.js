const { asyncHandler } = require('@vaultify/utils');
const workspaceService = require('./workspace.service');

const getWorkspace = asyncHandler(async (req, res) => {
  const workspace = await workspaceService.getWorkspace(req.user.workspaceId);
  if (!workspace) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Workspace not found' });
  }
  res.json({ workspace });
});

const inviteMember = asyncHandler(async (req, res) => {
  const { email, role } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'VALIDATION', message: 'Email is required' });
  }
  const workspace = await workspaceService.inviteMember(req.user.workspaceId, email, role);
  res.json({ message: 'Member invited', workspace });
});

const updateMemberRole = asyncHandler(async (req, res) => {
  const { memberId } = req.params;
  const { role } = req.body;
  if (!role) {
    return res.status(400).json({ error: 'VALIDATION', message: 'Role is required' });
  }
  const workspace = await workspaceService.updateMemberRole(req.user.workspaceId, memberId, role);
  res.json({ message: 'Role updated', workspace });
});

const removeMember = asyncHandler(async (req, res) => {
  const { memberId } = req.params;
  const workspace = await workspaceService.removeMember(req.user.workspaceId, memberId);
  res.json({ message: 'Member removed', workspace });
});

module.exports = { getWorkspace, inviteMember, updateMemberRole, removeMember };
