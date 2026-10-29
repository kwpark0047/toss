/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { authAPI } from '../api/auth';
import { storesAPI } from '../api/stores';
import { API_URL } from '../api/client';
import api from '../api/client';
import { syncSentryUser } from '../lib/sentry';
import { refreshSession } from '../lib/authSession';
import { clearUserCaches } from '../utils/userCaches';
import { logoutFlow } from '../lib/logoutFlow';

const AuthContext = createContext(null);

const USE_COOKIE = import.meta.env.VITE_HTTPONLY_COOKIE === 'true';

// JWT 페이로드를 네트워크 없이 즉시 디코드 (서명 검증 없음 — 만료 확인용)
const decodeToken = (token) => {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder('utf-8').decode(bytes));
  } catch {
    return null;
  }
};

// refreshToken으로 새 accessToken 발급
const refreshAccessToken = async () => {
  const data = await refreshSession(API_URL, USE_COOKIE);
  return data?.token || null;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // 로그인 직후 프리패치한 stores 캐시 (MasterDashboard가 즉시 소비)
  const storesCacheRef = useRef(null);
  const signupProofRef = useRef(null);
  const recentAuthProofRef = useRef(null);
  const acceptAuthentication = async (data) => {
    if (!data?.token || !data?.user?.id) throw new Error('인증 응답을 확인할 수 없습니다.');
    await clearUserCaches(); storesCacheRef.current = null; recentAuthProofRef.current = null;
    if (!USE_COOKIE) {
      localStorage.setItem('token', data.token);
      if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
    }
    setUser(data.user);
  };

  useEffect(() => {
    const loadUser = async () => {
      if (USE_COOKIE) {
        // 쿠키 모드: 토큰을 JS에서 읽을 수 없으므로 /auth/me 호출로 인증 확인
        try {
          const res = await api.get('/auth/me');
          const data = res?.data || res;
          if (data?.id) {
            setUser(data);
          }
        } catch {
          setUser(null);
        } finally {
          setLoading(false);
        }
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const payload = decodeToken(token);
      const validFor = payload?.exp ? payload.exp * 1000 - Date.now() : 0;

      if (payload && validFor > 0) {
        setUser({ id: payload.id, name: payload.name, role: payload.role });
        api.get('/auth/me').then((res) => {
          const profile = res?.data || res;
          if (profile?.id === payload.id) {
            setUser((previous) => previous?.id === payload.id ? { ...previous, ...profile } : previous);
          }
        }).catch(() => {});
        setLoading(false);
        if (validFor <= 300_000) {
          refreshAccessToken()
            .then((newToken) => {
              if (newToken)
                setUser((prev) => ({
                  ...prev,
                  ...{ id: payload.id, name: payload.name, role: payload.role },
                }));
            })
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
      } catch (error) {
        if ([401, 403].includes(error.status)) {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
        }
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const sendOtp = async (phone) => {
    signupProofRef.current = null;
    const res = await authAPI.sendOtp(phone);
    return res.data || res;
  };

  const verifyOtp = async (phone, otp) => {
    const res = await authAPI.verifyOtp(phone, otp);
    const data = res.data || res;
    signupProofRef.current = { phone: phone.replace(/\D/g, ''), token: data.verificationToken };
    return data;
  };

  const login = async (identifier, password) => {
    const res = await authAPI.login(identifier, password);
    const data = res.data || res;

    // 2FA가 활성화된 계정: tempToken을 반환하고 OTP 인증 단계로 전환
    // (tempToken은 localStorage의 'token'으로 저장하지 않는다 — API 401 잠금 방지)
    if (data.two_factor_required) {
      if (!data.tempToken) throw new Error('서버 응답이 올바르지 않습니다.');
      return { twoFactorRequired: true, tempToken: data.tempToken };
    }

    const { token, refreshToken, user: userData } = data;

    if (!token || !userData) throw new Error('서버 응답이 올바르지 않습니다.');

    if (!USE_COOKIE) {
      localStorage.setItem('token', token);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    }
    setUser(userData);

    storesAPI
      .getMy()
      .then((res) => {
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        storesCacheRef.current = { list, ts: Date.now() };
      })
      .catch(() => {});

    return { token, user: userData };
  };

  // 2차 로그인 OTP 발송 (tempToken 필요)
  const sendLoginOtp = async (tempToken) => {
    const res = await authAPI.sendLoginOtp(tempToken);
    return res.data || res;
  };

  // 2차 로그인 OTP 검증 → 최종 토큰 발급
  const verifyLoginOtp = async (tempToken, otp) => {
    const res = await authAPI.verifyLoginOtp(tempToken, otp);
    const data = res.data || res;
    const { token, refreshToken, user: userData } = data;

    if (!token || !userData) throw new Error('서버 응답이 올바르지 않습니다.');

    if (!USE_COOKIE) {
      localStorage.setItem('token', token);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    }
    setUser(userData);

    storesAPI
      .getMy()
      .then((res) => {
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        storesCacheRef.current = { list, ts: Date.now() };
      })
      .catch(() => {});

    return { token, user: userData };
  };

  // 2FA 활성화 상태 조회
  const getTwoFactorStatus = async () => {
    const res = await authAPI.getTwoFactorStatus();
    return (res.data || res)?.two_factor_enabled ?? false;
  };

  // 2FA 활성화/비활성화 OTP 발송
  const sendTwoFactorOtp = async (purpose) => {
    const res = await authAPI.sendTwoFactorOtp(purpose);
    return res.data || res;
  };

  // 2FA 활성화/비활성화 실행
  const verifyTwoFactorOtp = async (purpose, otp) => {
    const res = await authAPI.verifyTwoFactorOtp(purpose, otp);
    return (res.data || res)?.two_factor_enabled ?? false;
  };

  const register = async (data) => {
    const proof = signupProofRef.current;
    if (!proof?.token || proof.phone !== data.phone?.replace(/\D/g, ''))
      throw new Error('핸드폰 번호 인증을 다시 진행해 주세요.');
    const res = await authAPI.register({ ...data, verificationToken: proof.token });
    signupProofRef.current = null;
    const { token, refreshToken, user: userData } = res.data || res;

    if (!USE_COOKIE) {
      if (token) localStorage.setItem('token', token);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    }
    if (userData) setUser(userData);
    return { token, user: userData };
  };

  const refreshProfile = async () => {
    const response = await authAPI.me();
    const updated = response.data || response;
    if (!updated?.id) throw new Error('프로필 응답을 확인할 수 없습니다.');
    setUser((previous) => (previous?.id === updated.id ? { ...previous, ...updated } : previous));
    return updated;
  };

  const updateProfile = async (data) => {
    const res = await authAPI.updateProfile(data);
    const updated = res.data || res;
    setUser((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
    return updated;
  };

  const changePassword = async (currentPassword, newPassword) => {
    const res = await authAPI.changePassword(currentPassword, newPassword);
    return res.data || res;
  };

  const logout = async () => {
    return logoutFlow({
      revoke: () => authAPI.logout(),
      clearLocalSession: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        storesCacheRef.current = null;
        recentAuthProofRef.current = null; signupProofRef.current = null;
        setUser(null);
      },
      clearCaches: clearUserCaches,
    });
  };

  // Sentry에 사용자 컨텍스트 동기화 (운영 환경에서만 의미 있음 — 지연 로드)
  useEffect(() => {
    syncSentryUser(user);
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
    if(data.twoFactorRequired)return data;
    await acceptAuthentication(data);
    return { token:data.token, user:data.user };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        acceptAuthentication,
        clearAuthentication: async () => { localStorage.removeItem('token'); localStorage.removeItem('refreshToken'); await clearUserCaches(); recentAuthProofRef.current = null; signupProofRef.current = null; storesCacheRef.current = null; setUser(null); },
        getRecentAuthProof: () => recentAuthProofRef.current,
        clearRecentAuthProof: () => { recentAuthProofRef.current = null; },
        saveRecentAuthProof: (proof) => { recentAuthProofRef.current = proof; },
        consumeRecentAuthProof: () => { const proof = recentAuthProofRef.current; recentAuthProofRef.current = null; return proof; },
        loading,
        sendOtp,
        verifyOtp,
        login,
        socialLogin,
        register,
        updateProfile,
        refreshProfile,
        changePassword,
        logout,
        consumeStoresCache,
        sendLoginOtp,
        verifyLoginOtp,
        getTwoFactorStatus,
        sendTwoFactorOtp,
        verifyTwoFactorOtp,
      }}
    >
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
