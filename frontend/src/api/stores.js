import api from './client';

export const storesAPI = {
  getAll: () => api.get('/stores'),
  getMy: () => api.get('/stores/my'),
  getById: (id) => api.get('/stores/' + id),
  // 공개 매장 검색 (지역·업종·키워드·고객위치 거리순)
  searchPublic: (params = {}) => api.get('/stores/search', { params }),
  // 지역 하이라이트 배너 (추천메뉴 + 이벤트/프로모션)
  highlights: (params = {}) => api.get('/stores/highlights', { params }),
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
