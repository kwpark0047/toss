import api from './client';

export const reviewsAPI = {
  getStoreReviews: (storeId) => api.get(`/reviews/store/${storeId}`),
  getFeed: () => api.get('/reviews/feed'),
  create: (data) => api.post('/reviews', data),
  toggleLike: (id, userPhone) => api.post(`/reviews/${id}/like`, { user_phone: userPhone }),
  generateAiReply: (id) => api.post(`/reviews/${id}/ai-reply`),
  saveReply: (id, reply) => api.put(`/reviews/${id}/reply`, { reply }),
  deleteReply: (id) => api.delete(`/reviews/${id}/reply`),
};
