import api from './client';
const base = (storeId) => `/store-manager/stores/${encodeURIComponent(storeId)}`;
export const storeManagerAPI = {
  briefing: (storeId) => api.get(`${base(storeId)}/briefing`),
  transition: (storeId, id, event) =>
    api.post(`${base(storeId)}/actions/${encodeURIComponent(id)}/${event}`),
  evaluate: (storeId, id) =>
    api.get(`${base(storeId)}/actions/${encodeURIComponent(id)}/evaluation`),
  chat: (storeId, question) => api.post(`${base(storeId)}/chat`, { question }),
  featured: (storeId) => api.get(`${base(storeId)}/featured`, { timeout: 5000 }),
};
