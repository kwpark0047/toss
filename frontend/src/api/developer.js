import api from './client';

/**
 * developerAPI — Open Commerce Hub 개발자 콘솔 (API 키 · 웹훅 · 전송 로그)
 * 백엔드: routes/developer.js
 */
export const developerAPI = {
  // API 키
  listApiKeys: (storeId) => api.get(`/developer/stores/${storeId}/api-keys`),
  createApiKey: (storeId, data) => api.post(`/developer/stores/${storeId}/api-keys`, data),
  revokeApiKey: (storeId, keyId) => api.delete(`/developer/stores/${storeId}/api-keys/${keyId}`),

  // 웹훅 엔드포인트
  listWebhooks: (storeId) => api.get(`/developer/stores/${storeId}/webhooks`),
  createWebhook: (storeId, data) => api.post(`/developer/stores/${storeId}/webhooks`, data),
  deleteWebhook: (storeId, id) => api.delete(`/developer/stores/${storeId}/webhooks/${id}`),

  // 전송 로그
  listDeliveries: (storeId) => api.get(`/developer/stores/${storeId}/webhook-deliveries`),
};
