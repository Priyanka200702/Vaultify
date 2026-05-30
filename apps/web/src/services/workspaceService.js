import api from './api';

export const getWorkspace = () =>
  api.get('/api/workspace').then(r => r.data);

export const inviteMember = (email, role) =>
  api.post('/api/workspace/invite', { email, role }).then(r => r.data);

export const updateMemberRole = (memberId, role) =>
  api.patch(`/api/workspace/members/${memberId}`, { role }).then(r => r.data);

export const removeMember = (memberId) =>
  api.delete(`/api/workspace/members/${memberId}`).then(r => r.data);

export const getVaultKeys = () =>
  api.get('/api/vault/keys').then(r => r.data);

export const storeVaultKey = (data) =>
  api.post('/api/vault/keys', data).then(r => r.data);

export const rotateVaultKey = (id, newRawKey) =>
  api.put(`/api/vault/keys/${id}/rotate`, { newRawKey }).then(r => r.data);

export const deleteVaultKey = (id) =>
  api.delete(`/api/vault/keys/${id}`).then(r => r.data);

export const getKeyTokenCount = (id) =>
  api.get(`/api/vault/keys/${id}/tokens-count`).then(r => r.data);

export const getRequests = (status) => {
  const params = status ? `?status=${status}` : '';
  return api.get(`/api/requests${params}`).then(r => r.data);
};

export const submitRequest = (data) =>
  api.post('/api/requests', data).then(r => r.data);

export const approveRequest = (id, ownerNote, overrides) =>
  api.patch(`/api/requests/${id}/approve`, { ownerNote, overrides }).then(r => r.data);

export const denyRequest = (id, ownerNote) =>
  api.patch(`/api/requests/${id}/deny`, { ownerNote }).then(r => r.data);

export const getActiveTokens = () =>
  api.get('/api/tokens').then(r => r.data);

export const getRecentActivity = (limit = 5) =>
  api.get(`/api/audit?limit=${limit}`).then(r => r.data);
