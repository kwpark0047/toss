import api from './client';
const base = (storeId) => `/integrations/stores/${encodeURIComponent(storeId)}`;
export const integrationsAPI = {
  syncHistory: (storeId) => api.get(`${base(storeId)}/sync-history`),
  overview: (storeId, days) => api.get(`${base(storeId)}/overview`, { params: { days } }),
  create: (storeId, data) => api.post(`${base(storeId)}/connections`, data),
  toggle: (storeId, id, enabled) => api.patch(`${base(storeId)}/connections/${id}`, { enabled }),
  preview: (storeId, id, csv_text) =>
    api.post(`${base(storeId)}/connections/${id}/preview`, { csv_text }),
  import: (storeId, id, csv_text) =>
    api.post(`${base(storeId)}/connections/${id}/import`, { csv_text }),
};
