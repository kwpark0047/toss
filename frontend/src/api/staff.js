import api from './client';

export const staffAPI = {
  getByStore: (storeId) => api.get('/staff/store/' + storeId),
  getById: (id) => api.get('/staff/' + id),
  getMyRole: (storeId) => api.get(`/staff/store/${storeId}/role`),
  create: (data) => api.post('/staff', data),
  update: (id, data) => api.put('/staff/' + id, data),
  updateRole: (id, role) => api.put('/staff/' + id, { role }),
  delete: (id) => api.delete('/staff/' + id),
  getAttendance: (storeId, params) => api.get(`/staff/store/${storeId}/attendance`, { params }),
  clockIn: (id, note) => api.post(`/staff/${id}/clock-in`, { note }),
  clockOut: (id) => api.post(`/staff/${id}/clock-out`),
  selfRegister: (storeId) => api.post('/staff/self-register', { storeId }),
  lookupByPhone: (phone, storeId) => api.get('/staff/lookup-user', { params: { phone, storeId } }),
  addExisting: (data) => api.post('/staff/add-existing', data),
};
