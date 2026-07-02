import axios from 'axios';
import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { authAPI, storesAPI } from '../api';
import api from '../api';

const AuthContext = createContext(null);
const API_URL = 'https://wemarket.onrender.com/api';

// JWT 페이로드를 네트워크 없이 즉시 디코드 (서명 검증 없음 — 만료 확인용)
const decodeToken = (token) => {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64));
  } catch { return null; }
};

// refresh token으로 새 access token 발급 (Prisma 불필요 — JWT 서명만 검증)
const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;
  const res = await axios.post(`${API_URL}/auth/refresh-token`, { refreshToken });
  const d = res.data?.data || res.data;
  if (!d?.token) return null;
  localStorage.setItem('token', d.token);
  if (d.refreshToken) localStorage.setItem('refreshToken', d.refreshToken);
  return d.token;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // 로그인 직후 프리패치한 stores 캐시 (MasterDashboard가 즉시 소비)
  const storesCacheRef = useRef(null);

  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('token');
      if (!token) { setLoading(false); return; }

      // 1) JWT 로컬 디코드 — 네트워크 없이 즉시 유효성 확인
      const payload = decodeToken(token);
      const validFor = payload?.exp ? payload.exp * 1000 - Date.now() : 0;

      if (payload && validFor > 0) {
        // 토큰 아직 유효: 즉시 user 세팅 → loading 해제 (Prisma 대기 없음)
        setUser({ id: payload.id, name: payload.name, role: payload.role });
        setLoading(false);

        if (validFor <= 120_000) {
          // 만료 2분 이내: refresh token으로 조용히 갱신
          refreshAccessToken().catch(() => {});
        } else {
          // 충분한 유효기간: 2s 뒤 백그라운드 서버 검증 (_skipRedirect → 401에도 리다이렉트 안 함)
          setTimeout(() => {
            api.get('/auth/me', { _skipRedirect: true })
              .then(res => { const u = res?.data || res?.user || res; if (u?.id) setUser(u); })
              .catch(() => {});
          }, 2000);
        }
        return;
      }

      // 2) 토큰 완전 만료 → refresh token으로 재발급 시도 (authAPI.me() 호출 없음 — Prisma 행 방지)
      try {
        const newToken = await refreshAccessToken();
        if (newToken) {
          const newPayload = decodeToken(newToken);
          if (newPayload) {
            setUser({ id: newPayload.id, name: newPayload.name, role: newPayload.role });
          } else {
            setUser(null);
          }
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          setUser(null);
        }
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const sendOtp = async (phone) => {
    const res = await authAPI.sendOtp(phone);
    return res.data || res;
  };

  const verifyOtp = async (phone, otp) => {
    const res = await authAPI.verifyOtp(phone, otp);
    return res.data || res;
  };

  // identifier = 핸드폰 번호 또는 이메일
  const login = async (identifier, password) => {
    const res = await authAPI.login(identifier, password);
    const data = res.data || res;
    const { token, refreshToken, user: userData } = data;

    if (!token || !userData) throw new Error('서버 응답이 올바르지 않습니다.');

    localStorage.setItem('token', token);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    setUser(userData);

    // 로그인 즉시 stores 프리패치 → 대시보드 진입 시 API 대기 없이 즉시 렌더
    storesAPI.getMy()
      .then(res => {
        const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
        storesCacheRef.current = { list, ts: Date.now() };
      })
      .catch(() => {});

    return { token, user: userData };
  };

  // data: { phone, password } — OTP 인증 완료 후 호출
  const register = async (data) => {
    const res = await authAPI.register(data);
    const { token, refreshToken, user: userData } = res.data || res;

    if (token) localStorage.setItem('token', token);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    if (userData) setUser(userData);
    return { token, user: userData };
  };

  // 프로필 업데이트 (name, email, address 중 일부)
  const updateProfile = async (data) => {
    const res = await authAPI.updateProfile(data);
    const updated = res.data || res;
    setUser((prev) => ({ ...prev, ...updated }));
    return updated;
  };

  const changePassword = async (currentPassword, newPassword) => {
    const res = await authAPI.changePassword(currentPassword, newPassword);
    return res.data || res;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  // MasterDashboard가 캐시를 소비하는 함수 (한 번만 사용 가능)
  // useCallback([], []) — storesCacheRef는 Ref라 항상 최신값 참조. 참조 안정화로 fetchStores 재실행 방지.
  const consumeStoresCache = useCallback(() => {
    const cache = storesCacheRef.current;
    if (cache && Date.now() - cache.ts < 30_000) {
      storesCacheRef.current = null;
      return cache.list;
    }
    storesCacheRef.current = null;
    return null;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, sendOtp, verifyOtp, login, register, updateProfile, changePassword, logout, consumeStoresCache }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth는 AuthProvider 내에서 사용되어야 합니다.');
  return context;
};

export default AuthContext;
