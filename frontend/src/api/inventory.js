import api from './client';

export const inventoryAPI = {
  getInventory: (storeId, params = {}) => api.get(`/inventory/store/${storeId}`, { params }),
  getStoreHistory: (storeId, params = {}) =>
    api.get(`/inventory/store/${storeId}/history`, { params }),
  getLowStockAlerts: (storeId) => api.get(`/inventory/store/${storeId}/alerts`),
  adjustStock: (productId, data) => api.put(`/inventory/products/${productId}/stock`, data),
  setStock: (productId, data) => api.put(`/inventory/products/${productId}/stock/set`, data),
  getProductHistory: (productId, params = {}) =>
    api.get(`/inventory/products/${productId}/history`, { params }),
  generateReorderCandidates: (storeId, data = {}) =>
    api.post(`/inventory/store/${storeId}/reorder-candidates/generate`, data),
  getReorderCandidates: (storeId, status = 'pending') =>
    api.get(`/inventory/store/${storeId}/reorder-candidates`, { params: { status } }),
  decideReorderCandidate: (storeId, id, status) =>
    api.post(`/inventory/store/${storeId}/reorder-candidates/${id}/decide`, { status }),
};

export const aiAutoOrderAPI = {
  // 재고 부족 상품 조회
  getShortages: (storeId, params = {}) =>
    api.get(`/ai-auto-order/store/${storeId}/shortages`, { params }),
  // AI 자동 발주 추천 생성
  generateRecommendation: (storeId, data = {}) =>
    api.post(`/ai-auto-order/store/${storeId}/recommend`, data),
  // 발주 추천 목록 조회
  getRecommendations: (storeId, status = 'pending') =>
    api.get(`/ai-auto-order/store/${storeId}/recommendations`, { params: { status } }),
  // 발주 추천 상세 조회
  getRecommendation: (storeId, id) =>
    api.get(`/ai-auto-order/store/${storeId}/recommendations/${id}`),
  // 발주 추천 승인/거절/발주완료
  decideRecommendation: (storeId, id, status) =>
    api.post(`/ai-auto-order/store/${storeId}/recommendations/${id}/decide`, { status }),
  // 발주 추천 통계
  getStats: (storeId) => api.get(`/ai-auto-order/store/${storeId}/stats`),
};
