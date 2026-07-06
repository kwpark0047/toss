import axios from 'axios';

const getApiUrl = () => {
  // 1. VITE_API_URL 환경변수가 설정된 경우 최우선 사용 (Vercel/배포 환경)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // 2. 로컬 개발 환경 → localhost 폴백
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000/api';
  }
  // 3. 그 외(배포) 환경 → Render API로 안전 폴백.
  //    .env.production의 VITE_API_URL이 최우선이며, 미주입 시에도 앱이 깨지지
  //    않도록 알려진 프로덕션 백엔드로 폴백한다(빈 문자열 반환 금지).
  console.warn(
    '[API] VITE_API_URL 미설정 — 프로덕션 백엔드(Render)로 폴백합니다. ' +
    '권장: frontend/.env.production 또는 Vercel Environment Variables에 VITE_API_URL 설정.'
  );
  return 'https://wemarket.onrender.com/api';
};

const API_URL = getApiUrl();

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터 - 토큰 추가
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 응답 인터셉터 - 데이터 구조 표준화 및 에러 핸들링
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    // ── Render 콜드스타트 자동 재시도 ──
    const isNetworkError = !error.response;
    const isCorsOrNetworkError = error.code === 'ERR_NETWORK' || error.message?.includes('Network Error');
    if ((isNetworkError || isCorsOrNetworkError) && !originalRequest._coldRetry) {
      originalRequest._coldRetry = true;
      try {
        const { wakeupServer } = await import('./wakeup');
        await wakeupServer();
        return api(originalRequest);
      } catch {
        // 웨이크업 타임아웃 → 원래 에러 전파
      }
    }

    // 401 에러 처리 - 토큰 갱신
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/auth/refresh-token`, { refreshToken });
          const { token, refreshToken: newRefreshToken } = response.data.data || response.data;
          localStorage.setItem('token', token);
          localStorage.setItem('refreshToken', newRefreshToken);
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }
      } catch (err) {
        console.error('토큰 갱신 실패:', err);
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
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

export { API_URL };
export default api;
