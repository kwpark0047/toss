import api from './client';
import { getSocket } from '../utils/socket';

export const ordersAPI = {
  getSocket,
  getByStore: (storeId, status, date) => {
    let url = '/orders/store/' + storeId;
    const params = [];
    if (status) params.push('status=' + status);
    if (date) params.push('date=' + date);
    if (params.length > 0) url += '?' + params.join('&');
    return api.get(url);
  },
  getStats: (storeId, startDate, endDate) => {
    let url = '/orders/store/' + storeId + '/stats';
    const params = [];
    if (startDate) params.push('start_date=' + startDate);
    if (endDate) params.push('end_date=' + endDate);
    if (params.length > 0) url += '?' + params.join('&');
    return api.get(url);
  },
  create: (data) =>
    api.post('/orders', data, {
      headers: {
        'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      },
    }),
  updateStatus: (id, status, staffId = null) =>
    api.put('/orders/' + id + '/status', { status, staff_id: staffId }),
  cancel: (id) => api.post('/orders/' + id + '/cancel'),
  delete: (id) => api.delete('/orders/' + id),
  getById: (id) => api.get('/orders/' + id),
  getDetailedStats: (storeId, startDate, endDate) => {
    let url = '/orders/store/' + storeId + '/detailed-stats';
    const params = [];
    if (startDate) params.push('start_date=' + startDate);
    if (endDate) params.push('end_date=' + endDate);
    if (params.length > 0) url += '?' + params.join('&');
    return api.get(url);
  },
  getEta: (storeId, items) =>
    api.get('/orders/store/' + storeId + '/eta', {
      params: { items: JSON.stringify(items || []) },
    }),
};

export const paymentsAPI = {
  create: (data) => api.post('/payments', data),
  prepare: (data, capability) =>
    api.post('/payments/ready', data, {
      headers: capability ? { 'x-order-capability': capability } : undefined,
    }),
  getById: (id) => api.get('/payments/' + id),
  confirm: (id, data, capability) =>
    api.post(
      '/payments/' + id + '/confirm',
      data,
      capability ? { headers: { 'x-order-capability': capability } } : undefined
    ),
  cancel: (id, data) => api.post('/payments/' + id + '/cancel', data),
  cancelByOrder: (orderId, data) => api.post('/payments/order/' + orderId + '/cancel', data),
  partialCancel: (orderId, cancelAmount, cancelReason) =>
    api.post(
      '/payments/order/' + orderId + '/partial-cancel',
      { cancelAmount, cancelReason },
      {
        headers: {
          'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        },
      }
    ),
  uploadProof: (id, formData) =>
    api.post(`/payments/${id}/proof`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getBrandPayConfig: () => api.get('/payments/brandpay/config'),
  splitRequest: (data, capability) =>
    api.post('/payments/split/request', data, {
      headers: { 'x-order-capability': capability },
    }),
  splitPay: (data, capability) =>
    api.post('/payments/split/pay', data, {
      headers: {
        'x-order-capability': capability,
        'Idempotency-Key': crypto.randomUUID(),
      },
    }),
  splitStatus: (orderId, capability) =>
    api.get('/payments/split/' + orderId + '/status', {
      headers: { 'x-order-capability': capability },
    }),
};
