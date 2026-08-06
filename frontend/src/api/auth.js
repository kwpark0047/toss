import api from './client';

export const authAPI = {
  sendOtp: (phone) => api.post('/auth/send-otp', { phone }),
  verifyOtp: (phone, otp) => api.post('/auth/verify-otp', { phone, otp }),
  register: (data) => api.post('/auth/register', data),
  login: (identifier, password) => api.post('/auth/login', { identifier, password }),
  sendLoginOtp: (tempToken) =>
    api.post('/auth/2fa/send-login-otp', {}, { headers: { Authorization: `Bearer ${tempToken}` } }),
  verifyLoginOtp: (tempToken, otp) =>
    api.post(
      '/auth/2fa/verify-login-otp',
      { otp },
      { headers: { Authorization: `Bearer ${tempToken}` } }
    ),
  getTwoFactorStatus: () => api.get('/auth/2fa/status'),
  sendTwoFactorOtp: (purpose) => api.post('/auth/2fa/send-otp', { purpose }),
  verifyTwoFactorOtp: (purpose, otp) => api.post('/auth/2fa/verify', { purpose, otp }),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (current_password, new_password) =>
    api.put('/auth/password', { current_password, new_password }),
  socialLogin: (provider, accessToken) => api.post(`/auth/social/${provider}`, { accessToken }),
};
