import api from './client';
export const subscriptionsAPI = {
  get: (id) => api.get(`/subscriptions/${id}`),
  invoices: (id) => api.get(`/subscriptions/${id}/invoices`),
  checkout: (id, plan, cycle, mode = 'subscribe') =>
    api.post(`/subscriptions/${id}/checkout`, {
      plan_id: plan,
      billing_cycle: cycle,
      mode,
      automatic_payment_consent: true,
    }),
  activate: (id, data, key) =>
    api.post(`/subscriptions/${id}/activate`, data, { headers: { 'Idempotency-Key': key } }),
  cancel: (id) => api.post(`/subscriptions/${id}/cancel`),
  resume: (id) => api.post(`/subscriptions/${id}/resume`, { automatic_payment_consent: true }),
  changePlan: (id, plan, cycle) =>
    api.post(`/subscriptions/${id}/plan`, {
      plan_id: plan,
      billing_cycle: cycle,
      automatic_payment_consent: true,
    }),
  retry: (id, invoice, key) =>
    api.post(
      `/subscriptions/${id}/invoices/${invoice}/retry`,
      {},
      { headers: { 'Idempotency-Key': key } }
    ),
};
