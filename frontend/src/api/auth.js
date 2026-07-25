import api from './client';

export const authAPI = {
  sendOtp: (phone) => api.post('/auth/send-otp', { phone }),
  verifyOtp: (phone, otp) => api.post('/auth/verify-otp', { phone, otp }),
  register: (data) => api.post('/auth/register', data),
  login: (identifier, password) => api.post('/auth/login', { identifier, password }),
  me: () => api.get('/auth/me'),
  logout: () => Promise.resolve(),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (current_password, new_password) => api.put('/auth/password', { current_password, new_password }),
  socialLogin: (provider, accessToken) => api.post(`/auth/social/${provider}`, { accessToken }),
};
