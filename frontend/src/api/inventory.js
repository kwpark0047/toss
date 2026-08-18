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
