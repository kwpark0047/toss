import api from './client';
import { wakeupServer } from './wakeup';

// Probe with a safe read before a non-repeatable authentication/SMS write.
async function readyPost(url, data) {
  try {
    await wakeupServer();
  } catch {
    throw new Error(
      '서버가 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요. 인증 요청은 전송하지 않았습니다.'
    );
  }
  try {
    return await api.post(url, data);
  } catch (error) {
    if (['ECONNABORTED', 'ETIMEDOUT'].includes(error.code)) {
      error.message =
        '요청 처리 결과를 확인하지 못했습니다. 자동 재전송하지 않았습니다. 인증 문자를 요청했다면 도착 여부를 먼저 확인해 주세요.';
    }
    throw error;
  }
}

export const authAPI = {
  sendOtp: (phone) => readyPost('/auth/send-otp', { phone }),
  verifyOtp: (phone, otp) => readyPost('/auth/verify-otp', { phone, otp }),
  register: (data) => readyPost('/auth/register', data),
  login: (identifier, password) => readyPost('/auth/login', { identifier, password }),
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
  logout: () =>
    api.post('/auth/logout', { refreshToken: localStorage.getItem('refreshToken') || undefined }),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (current_password, new_password) =>
    api.put('/auth/password', { current_password, new_password }),
  socialLogin: (provider, accessToken) => api.post(`/auth/social/${provider}`, { accessToken }),
};
