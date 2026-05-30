const { Workspace, User } = require('@vaultify/db');
const { createError } = require('../../middleware/errorHandler');

/**
 * Gets a workspace by ID with members.
 */
async function getWorkspace(workspaceId) {
  return Workspace.findById(workspaceId).lean();
}

/**
 * Invites a user to a workspace by email.
 */
async function inviteMember(workspaceId, email, role = 'member') {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw createError('User not found. They must register first.', 400, 'BAD_REQUEST');

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw createError('Workspace not found', 400, 'BAD_REQUEST');

  const existing = workspace.members.find((m) => m.email === email.toLowerCase());
  if (existing) throw createError('User is already a member of this workspace', 400, 'BAD_REQUEST');

  workspace.members.push({
    userId: user._id,
    email: user.email,
    name: user.name,
    role,
  });
  await workspace.save();

  // Update user's workspace reference
  user.workspaceId = workspaceId;
  user.role = role;
  await user.save();

  return workspace;
}

/**
 * Updates a member's role.
 */
async function updateMemberRole(workspaceId, memberId, newRole) {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw new Error('Workspace not found');

  const member = workspace.members.find((m) => m.userId.toString() === memberId);
  if (!member) throw new Error('Member not found in workspace');

  member.role = newRole;
  await workspace.save();

  // Also update the user's role
  await User.findByIdAndUpdate(memberId, { role: newRole });

  return workspace;
}

/**
 * Removes a member from the workspace.
 */
async function removeMember(workspaceId, memberId) {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw new Error('Workspace not found');

  workspace.members = workspace.members.filter((m) => m.userId.toString() !== memberId);
  await workspace.save();

  return workspace;
}

module.exports = { getWorkspace, inviteMember, updateMemberRole, removeMember };
