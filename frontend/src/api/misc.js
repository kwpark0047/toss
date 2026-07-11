import api from './client';

export const pointsAPI = {
  getBalance: (params) => api.get('/points/balance', { params }),
  getHistory: (params) => api.get('/points/history', { params }),
  calculateUsable: (amount, storeId, params) =>
    api.get(`/points/calculate-usable?amount=${amount}&store_id=${storeId}`, { params }),
  calculateEarn: (amount, storeId) =>
    api.get(`/points/calculate-earn?amount=${amount}&store_id=${storeId}`),
};

export const analyticsAPI = {
  getSales: (storeId, period, startDate, endDate) =>
    api.get(`/analytics/store/${storeId}/sales?period=${period}&start_date=${startDate}&end_date=${endDate}`),
  getComparison: (storeId, type) =>
    api.get(`/analytics/store/${storeId}/comparison?type=${type}`),
  getProducts: (storeId, startDate, endDate, limit = 10, sort = 'quantity') =>
    api.get(`/analytics/store/${storeId}/products?start_date=${startDate}&end_date=${endDate}&limit=${limit}&sort=${sort}`),
  getStaff: (storeId, startDate, endDate) =>
    api.get(`/analytics/store/${storeId}/staff?start_date=${startDate}&end_date=${endDate}`),
  getKds: (storeId, startDate, endDate) =>
    api.get(`/analytics/store/${storeId}/kds?start_date=${startDate}&end_date=${endDate}`),
  getInsights: (storeId, startDate, endDate) =>
    api.get(`/analytics/store/${storeId}/insights?start_date=${startDate}&end_date=${endDate}`),
  getMultiStore: (params) => api.get('/analytics/multi-store', { params }),
  getForecast: (storeId, days = 7) =>
    api.get(`/analytics/store/${storeId}/forecast?days=${days}`),
};

export const uploadsAPI = {
  uploadImage: (formData) => api.post('/uploads/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  uploadImages: (formData) => api.post('/uploads/images', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  uploadReviewImage: (formData) => api.post('/uploads/review-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteImage: (filename) => api.delete(`/uploads/image/${filename}`),
};

export const waitingAPI = {
  getStatus: (storeId) => api.get(`/waiting/store/${storeId}/status`),
  register: (data) => api.post('/waiting/register', data),
  cancel: (id) => api.patch(`/waiting/${id}/status`, { status: 'cancelled' }),
  getMyWaiting: (phone) => api.get(`/waiting/my/${phone}`),
};

export const reservationsAPI = {
  register: (data) => api.post('/reservations/register', data),
  getByStore: (storeId, params) => api.get(`/reservations/store/${storeId}`, { params }),
  updateStatus: (id, status) => api.patch(`/reservations/${id}/status`, { status }),
  cancel: (id, phone) => api.patch(`/reservations/${id}/cancel`, { phone }),
  getMyReservations: (phone) => api.get(`/reservations/my/${phone}`),
};

export const tablesAPI = {
  getByStore: (storeId) => api.get('/tables/store/' + storeId),
  getByQrCode: (qrCode) => api.get('/tables/qr/' + qrCode),
  create: (data) => api.post('/tables', data),
  update: (id, data) => api.put('/tables/' + id, data),
  delete: (id) => api.delete('/tables/' + id),
  regenerateQr: (id) => api.post('/tables/' + id + '/regenerate-qr'),
};

export const cartAPI = {
  getCart: (tableId) => api.get(`/cart/${tableId}`),
  updateItem: (tableId, data) => api.post(`/cart/${tableId}`, data),
  clearCart: (tableId) => api.delete(`/cart/${tableId}`),
};

export const legalAPI = {
  getInfo: (storeId) => api.get(`/legal/stores/${storeId}`),
  getTerms: (storeId) => api.get(`/legal/stores/${storeId}/terms`),
  getPrivacy: (storeId) => api.get(`/legal/stores/${storeId}/privacy`),
  getRefund: (storeId) => api.get(`/legal/stores/${storeId}/refund`),
  adminGet: (storeId) => api.get(`/legal/admin/stores/${storeId}`),
  adminUpdate: (storeId, data) => api.put(`/legal/admin/stores/${storeId}`, data),
  verifyBizNum: (storeId, business_number) =>
    api.post(`/legal/admin/stores/${storeId}/verify-business`, { business_number }),
};

export const aiAPI = {
  describeMenu: (data) => api.post('/ai/describe-menu', data),
  recommend: (data) => api.post('/ai/recommend', data),
  translate: (text, targetLang) => api.post('/ai/translate', { text, targetLang }),
  storytelling: (data) => api.post('/ai/storytelling', data),
  analyzeMenuList: (data) => api.post('/ai/analyze-menu-list', data),
  recommendEnhancement: (description) => api.post('/ai/recommend-enhancement', { description }),
  translateMenu: (storeId, targetLang) => api.post('/ai/translate-menu', { store_id: storeId, targetLang }),
  recommendPersonalized: (data) => api.post('/ai/recommend', data),
  recommendDessert: (data) => api.post('/ai/recommend-dessert', data),
  proposeMenuFull: (data) => api.post('/ai/propose-menu-full', data),
  generateMenuImage: (data) => api.post('/ai/generate-menu-image', data),
  generateInstagramCopy: (data) => api.post('/ai/instagram', data),
};

export const getSocket = () => {
  if (window.orderSocket) return window.orderSocket;
  return null;
};
