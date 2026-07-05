import api from './client';

export const inventoryAPI = {
  getInventory: (storeId, params = {}) =>
    api.get(`/inventory/store/${storeId}`, { params }),
  getStoreHistory: (storeId, params = {}) =>
    api.get(`/inventory/store/${storeId}/history`, { params }),
  getLowStockAlerts: (storeId) =>
    api.get(`/inventory/store/${storeId}/alerts`),
  adjustStock: (productId, data) =>
    api.put(`/inventory/products/${productId}/stock`, data),
  setStock: (productId, data) =>
    api.put(`/inventory/products/${productId}/stock/set`, data),
  getProductHistory: (productId, params = {}) =>
    api.get(`/inventory/products/${productId}/history`, { params }),
};
