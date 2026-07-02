import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { authAPI, storesAPI } from '../api';

const AuthContext = createContext(null);

// JWT 페이로드를 네트워크 없이 즉시 디코드 (서명 검증 없음 — 만료 확인용)
const decodeToken = (token) => {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64));
  } catch { return null; }
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

      if (payload && validFor > 60_000) {
        // 토큰 유효: user 즉시 세팅 → 앱 즉시 언블록
        setUser({ id: payload.id, name: payload.name, role: payload.role });
        setLoading(false);

        // 백그라운드에서 서버 검증 (UI 차단 없음)
        authAPI.me()
          .then(res => { const u = res?.data || res?.user || res; if (u?.id) setUser(u); })
          .catch(() => {
            // 네트워크/서버 일시 오류 시 로컬 JWT가 유효하므로 로그아웃하지 않음.
            // 401 인증 만료는 Axios 인터셉터가 token refresh 또는 /login 리다이렉트로 처리.
          });
        return;
      }

      // 2) 토큰 만료 또는 디코드 실패 → 서버에서 갱신 시도
      try {
        const res = await authAPI.me();
        setUser(res?.data || res?.user || res);
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
