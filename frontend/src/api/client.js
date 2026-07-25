import axios from 'axios';
import { extractErrorMessage } from '@/lib/errorUtils';

const getApiUrl = () => {
  // 1순위: 환경변수 (VITE_API_URL)
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;

  // 2순위: VITE_BACKEND_URL + /api
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  if (backendUrl) return `${backendUrl}/api`;

  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  if (isLocalhost) {
    // 개발 환경: 로컬 서버로 폴백 (Vite dev server가 5173이므로 Express는 3000)
    return 'http://localhost:3000/api';
  }

  // 프로덕션: 같은 origin의 /api로 프록시
  return `${window.location.origin}/api`;
};

const API_URL = getApiUrl();

/** API_URL의 `/api` 접미사를 제거한 베이스 URL (웨이크업 등에 사용) */
const getBaseUrl = () => API_URL.replace(/\/api(?:\/.*)?$/, '');

const USE_COOKIE = import.meta.env.VITE_HTTPONLY_COOKIE === 'true';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // HttpOnly Cookie 전송에 필요
});

// 요청 인터셉터 - 토큰 추가 (쿠키 모드 아니면 Authorization 헤더 사용)
api.interceptors.request.use((config) => {
  if (!USE_COOKIE) {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// 응답 인터셉터 - 데이터 구조 표준화 및 에러 핸들링
const CLIENT_ERROR_LOG = '[@wemarket/api]';
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    // ── Render 콜드스타트 자동 재시도: 네트워크 에러 또는 502/503 응답 ──
    const isNetworkError = !error.response;
    const isSleepingResponse = error.response?.status === 502 || error.response?.status === 503;
    if ((isNetworkError || isSleepingResponse) && !originalRequest._coldRetry) {
      originalRequest._coldRetry = true;
      try {
        const { wakeupServer } = await import('./wakeup');
        await wakeupServer();
        return api(originalRequest);
      } catch {
        // 웨이크업 타임아웃 → 원래 에러 전파
      }
    }

    // 전역 에러 로깅 (401 제외 — 토큰 갱신 로직에서 처리)
    if (error.response?.status && error.response.status !== 401) {
      const summary = extractErrorMessage(error);
      console.warn(`${CLIENT_ERROR_LOG} ${error.config?.method?.toUpperCase()} ${error.config?.url} → ${error.response.status}: ${summary}`);
    }

    // 401 에러 처리 - 토큰 갱신
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshBody = USE_COOKIE ? {} : { refreshToken: localStorage.getItem('refreshToken') };
        const response = await axios.post(`${API_URL}/auth/refresh-token`, refreshBody, { withCredentials: true });
        const { token, refreshToken: newRefreshToken } = response.data.data || response.data;
        if (!USE_COOKIE) {
          localStorage.setItem('token', token);
          localStorage.setItem('refreshToken', newRefreshToken);
          originalRequest.headers.Authorization = `Bearer ${token}`;
        }
        return api(originalRequest);
      } catch (err) {
        console.error('토큰 갱신 실패:', err);
        if (!USE_COOKIE) {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
        }
        const path = window.location.pathname;
        const isPublicPage = path.startsWith('/menu') || path.startsWith('/qr') || path === '/';
        if (!isPublicPage && !path.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export { API_URL, getBaseUrl };
export default api;
