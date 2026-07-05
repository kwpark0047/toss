import api from './client';

export const storesAPI = {
  getAll: () => api.get('/stores'),
  getMy: () => api.get('/stores/my'),
  getById: (id) => api.get('/stores/' + id),
  create: (data) => api.post('/stores', data),
  update: (id, data) => api.put('/stores/' + id, data),
  delete: (id) => api.delete('/stores/' + id),
};

export const storeAccountAPI = {
  get: (storeId) => api.get('/stores/' + storeId + '/account'),
  getPublic: (storeId) => api.get('/stores/' + storeId + '/account/public'),
  update: (storeId, data) => api.put('/stores/' + storeId + '/account', data),
};

export const businessAPI = {
  get: (storeId) => api.get('/stores/' + storeId + '/business'),
  update: (storeId, data) => api.put('/stores/' + storeId + '/business', data),
  issueInvoice: (storeId, settlementId) => api.post(`/admin/stores/${storeId}/settlements/${settlementId}/tax-invoice`),
  confirmStoreCard: (orderId, data) => api.post(`/payments/order/${orderId}/confirm-store-card`, data),
  confirmTransfer: (orderId, data) => api.post(`/payments/order/${orderId}/confirm-transfer`, data),
};
