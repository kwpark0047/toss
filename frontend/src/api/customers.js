import api from './client';

export const customersAPI = {
  getAll: (search) => api.get('/customers' + (search ? '?search=' + search : '')),
  getById: (id) => api.get('/customers/' + id),
  getStats: () => api.get('/customers/stats'),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put('/customers/' + id, data),
  delete: (id) => api.delete('/customers/' + id),
  phoneJoin: (data) => api.post('/customers/phone-join', data),
  registerFcmToken: (phone, storeId, fcmToken) =>
    api.post('/customers/fcm-token', { phone, store_id: storeId, fcm_token: fcmToken }),
};
