import api from './client';
export const marketingDraftAPI = {
  catalogue: (storeId) => api.get('/ai/marketing-drafts', { params: { store_id: storeId } }),
  generate: (data) => api.post('/ai/marketing-drafts', data),
};
