import api from './api';

export const getAuditLogs = (page = 1, limit = 20, filters = {}) => {
  const params = new URLSearchParams({ page, limit, ...filters });
  return api.get(`/api/audit?${params}`).then(r => r.data);
};

export const getAuditStats = () =>
  api.get('/api/audit/stats').then(r => r.data);
