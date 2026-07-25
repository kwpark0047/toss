import api from './client';

export const notificationsAPI = {
  getList: (storeId, params = {}) =>
    api.get('/notifications', { params: { store_id: storeId, ...params } }),
  getUnreadCount: (storeId) =>
    api.get('/notifications/unread-count', { params: { store_id: storeId } }),
  markAsRead: (id) =>
    api.patch(`/notifications/${id}/read`),
  markAllAsRead: (storeId) =>
    api.patch('/notifications/read-all', null, { params: { store_id: storeId } }),
  delete: (id) =>
    api.delete(`/notifications/${id}`),
  clear: (storeId, mode = 'read') =>
    api.delete('/notifications/clear', { params: { store_id: storeId, mode } }),
  registerToken: (token) =>
    api.post('/notifications/register-token', { token }),
};

export const notificationTemplatesAPI = {
  getList: (storeId, params = {}) =>
    api.get('/notification-templates', { params: { store_id: storeId, ...params } }),
  get: (id) =>
    api.get(`/notification-templates/${id}`),
  create: (data) =>
    api.post('/notification-templates', data),
  update: (id, data) =>
    api.put(`/notification-templates/${id}`, data),
  delete: (id) =>
    api.delete(`/notification-templates/${id}`),
};
