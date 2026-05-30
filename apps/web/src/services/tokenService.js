import api from './api';

export const getTokens = (includeRevoked = false) =>
  api.get(`/api/tokens?includeRevoked=${includeRevoked}`).then(r => r.data);

export const issueToken = (data) =>
  api.post('/api/tokens', data).then(r => r.data);

export const revokeToken = (id) =>
  api.delete(`/api/tokens/${id}`).then(r => r.data);

export const getToken = (id) =>
  api.get(`/api/tokens/${id}`).then(r => r.data);
