/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import * as Sentry from '@sentry/react';
import { authAPI } from '../api/auth';
import { storesAPI } from '../api/stores';
import { API_URL } from '../api/client';
import api from '../api/client';

const AuthContext = createContext(null);

const USE_COOKIE = import.meta.env.VITE_HTTPONLY_COOKIE === 'true';

// JWT 페이로드를 네트워크 없이 즉시 디코드 (서명 검증 없음 — 만료 확인용)
const decodeToken = (token) => {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder('utf-8').decode(bytes));
  } catch { return null; }
};

// refreshToken으로 새 accessToken 발급
const refreshAccessToken = async () => {
  // 쿠키 모드: refreshToken이 HttpOnly Cookie로 자동 전송
  if (USE_COOKIE) {
    const res = await fetch(`${API_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) return null;
    const d = (await res.json())?.data;
    return d?.token || null;
  }

  // 헤더 모드: localStorage에서 refreshToken 읽어 전송
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;
  const res = await fetch(`${API_URL}/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  const d = json?.data || json;
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
      if (USE_COOKIE) {
        // 쿠키 모드: 토큰을 JS에서 읽을 수 없으므로 /auth/me 호출로 인증 확인
        try {
          const res = await api.get('/auth/me');
          const data = res?.data || res;
          if (data?.id) {
            setUser({ id: data.id, name: data.name, role: data.role });
          }
        } catch {
          setUser(null);
        } finally {
          setLoading(false);
        }
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) { setLoading(false); return; }

      const payload = decodeToken(token);
      const validFor = payload?.exp ? payload.exp * 1000 - Date.now() : 0;

      if (payload && validFor > 0) {
        setUser({ id: payload.id, name: payload.name, role: payload.role });
        setLoading(false);
        if (validFor <= 300_000) {
          refreshAccessToken()
            .then(newToken => { if (newToken) setUser(prev => ({ ...prev, ...{ id: payload.id, name: payload.name, role: payload.role } })); })
            .catch(() => {});
        }
        return;
      }

      try {
        const newToken = await refreshAccessToken();
        if (newToken) {
          const p = decodeToken(newToken);
          if (p) setUser({ id: p.id, name: p.name, role: p.role });
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

  const login = async (identifier, password) => {
    const res = await authAPI.login(identifier, password);
    const data = res.data || res;
    const { token, refreshToken, user: userData } = data;

    if (!token || !userData) throw new Error('서버 응답이 올바르지 않습니다.');

    if (!USE_COOKIE) {
      localStorage.setItem('token', token);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    }
    setUser(userData);

    storesAPI.getMy()
      .then(res => {
        const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
        storesCacheRef.current = { list, ts: Date.now() };
      })
      .catch(() => {});

    return { token, user: userData };
  };

  const register = async (data) => {
    const res = await authAPI.register(data);
    const { token, refreshToken, user: userData } = res.data || res;

    if (!USE_COOKIE) {
      if (token) localStorage.setItem('token', token);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    }
    if (userData) setUser(userData);
    return { token, user: userData };
  };

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

  const logout = async () => {
    if (USE_COOKIE) {
      // 쿠키 모드: HttpOnly 쿠키는 JS 로 지울 수 없으므로 서버에 삭제를 요청한다.
      try {
        const { authAPI } = await import('@/api');
        await authAPI.logout();
      } catch {
        // 로그아웃 실패는 치명적이지 않다 — 사용자 상태만 초기화한다.
      }
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
    }
    setUser(null);
  };

  // Sentry에 사용자 컨텍스트 동기화 (운영 환경에서만 의미 있음 — SDK가 dev에서는 no-op)
  useEffect(() => {
    if (!user) {
      Sentry.setUser(null);
      return;
    }
    Sentry.setUser({
      id: String(user.id ?? ''),
      username: user.name ?? undefined,
      role: user.role ?? undefined,
    });
    Sentry.setTag('user_role', user.role ?? 'anonymous');
  }, [user]);

  // MasterDashboard가 캐시를 소비하는 함수 (한 번만 사용 가능)
  const consumeStoresCache = () => {
    const cache = storesCacheRef.current;
    if (cache && Date.now() - cache.ts < 30_000) {
      storesCacheRef.current = null;
      return cache.list;
    }
    storesCacheRef.current = null;
    return null;
  };

  const socialLogin = async (provider, accessToken) => {
    const res = await authAPI.socialLogin(provider, accessToken);
    const data = res.data || res;
    const { token, refreshToken, user: userData } = data;
    if (!token || !userData) throw new Error('서버 응답이 올바르지 않습니다.');

    if (!USE_COOKIE) {
      localStorage.setItem('token', token);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    }
    setUser(userData);
    return { token, user: userData };
  };

  return (
    <AuthContext.Provider value={{ user, loading, sendOtp, verifyOtp, login, socialLogin, register, updateProfile, changePassword, logout, consumeStoresCache }}>
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
