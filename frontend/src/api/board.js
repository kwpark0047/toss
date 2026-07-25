import api from './client';

export const boardAPI = {
  getPosts: (type, params) => api.get(`/boards/${type}`, { params }),
  getTrending: (limit = 5) => api.get(`/boards/trending`, { params: { limit } }),
  getPost: (id) => api.get(`/boards/posts/${id}`),
  createPost: (type, data) => api.post(`/boards/${type}`, data),
  updatePost: (id, data) => api.put(`/boards/posts/${id}`, data),
  deletePost: (id) => api.delete(`/boards/posts/${id}`),
  togglePin: (id) => api.put(`/boards/posts/${id}/pin`),
  toggleLike: (id) => api.post(`/boards/posts/${id}/like`),
  getComments: (postId) => api.get(`/boards/posts/${postId}/comments`),
  createComment: (postId, data) => api.post(`/boards/posts/${postId}/comments`, data),
  deleteComment: (id) => api.delete(`/boards/comments/${id}`),
};

export const communityAPI = {
  getFeed: (params = {}) => api.get('/community/feed', { params }),
  getMyPosts: (params = {}) => api.get('/community/my-posts', { params }),
  createPost: (data) => api.post('/community/posts', data),
  updatePost: (id, data) => api.put(`/community/posts/${id}`, data),
  deletePost: (id) => api.delete(`/community/posts/${id}`),
  likePost: (id) => api.post(`/community/posts/${id}/like`),
  getNearby: (params = {}) => api.get('/community/nearby', { params }),
  getPartnerships: (storeId) => api.get('/community/partnerships', { params: { store_id: storeId } }),
  requestPartnership: (data) => api.post('/community/partnerships', data),
  respondPartnership: (id, action) => api.put(`/community/partnerships/${id}/respond`, { action }),
};

export const chatAPI = {
  accessRoom: (data) => api.post('/chat/rooms/access', data),
  accessAdminRoom: (data) => api.post('/chat/rooms/admin/access', data),
  getAdminRooms: () => api.get('/chat/rooms/admin'),
  getMessages: (roomId) => api.get(`/chat/rooms/${roomId}/messages`),
  sendMessage: (data) => api.post('/chat/messages', data),
  markAsRead: (roomId, data) => api.patch(`/chat/rooms/${roomId}/read`, data),
};
