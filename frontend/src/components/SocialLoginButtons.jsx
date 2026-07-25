import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

const loadScript = (src) =>
  new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });

const SocialLoginButtons = ({ onSuccess, loading }) => {
  const { t } = useTranslation(undefined, { keyPrefix: 'auth' });
  const [error, setError] = useState('');

  const KAKAO_KEY = import.meta.env.VITE_KAKAO_JS_KEY;
  const NAVER_KEY = import.meta.env.VITE_NAVER_CLIENT_ID;
  const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const hasAnyProvider = KAKAO_KEY || NAVER_KEY || GOOGLE_KEY;
  if (!hasAnyProvider) return null;

  const handleKakao = useCallback(async () => {
    try {
      setError('');
      await loadScript('https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js');
      if (!window.Kakao.isInitialized()) {
        window.Kakao.init(KAKAO_KEY);
      }
      window.Kakao.Auth.login({
        success: (auth) => onSuccess('kakao', auth.access_token),
        fail: (err) => setError(err?.message || '카카오 로그인에 실패했습니다.'),
      });
    } catch (err) {
      setError('카카오 SDK를 불러오지 못했습니다.');
    }
  }, [KAKAO_KEY, onSuccess]);

  const handleNaver = useCallback(async () => {
    try {
      setError('');
      const redirectUri = window.location.origin + '/login';
      const state = Math.random().toString(36).substring(2);

      // Open Naver OAuth popup for token-based flow
      const authUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=token&client_id=${NAVER_KEY}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

      const popup = window.open(authUrl, 'naverLogin', 'width=500,height=600');
      if (!popup) {
        setError('팝업이 차단되었습니다. 팝업을 허용해 주세요.');
        return;
      }

      // Poll for the popup to redirect back with token in URL hash
      const timer = setInterval(() => {
        try {
          if (!popup || popup.closed) {
            clearInterval(timer);
            return;
          }
          const href = popup.location.href;
          if (href && href.startsWith(window.location.origin + '/login')) {
            clearInterval(timer);
            const hash = new URLSearchParams(href.split('#')[1]);
            const accessToken = hash.get('access_token');
            if (accessToken) {
              popup.close();
              onSuccess('naver', accessToken);
            }
          }
        } catch {
          // Cross-origin error before redirect is expected
        }
      }, 300);

      // Fallback: close popup after 2 minutes
      setTimeout(() => {
        clearInterval(timer);
        try { popup?.close(); } catch {}
      }, 120000);
    } catch (err) {
      setError('네이버 로그인에 실패했습니다.');
    }
  }, [NAVER_KEY, onSuccess]);

  const handleGoogle = useCallback(async () => {
    try {
      setError('');
      await loadScript('https://accounts.google.com/gsi/client');

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_KEY,
        scope: 'openid email profile',
        callback: (response) => {
          if (response.access_token) {
            onSuccess('google', response.access_token);
          } else {
            setError('Google 로그인에 실패했습니다.');
          }
        },
        error_callback: (err) => {
          setError(err?.message || 'Google 로그인에 실패했습니다.');
        },
      });
      client.requestAccessToken();
    } catch (err) {
      setError('Google SDK를 불러오지 못했습니다.');
    }
  }, [GOOGLE_KEY, onSuccess]);

  return (
    <div className="mt-8">
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-4 text-sm text-slate-400 font-medium">{t('social_or', '또는')}</span>
        </div>
      </div>

      <div className="space-y-3">
        {error && (
          <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-xs text-center font-medium">
            {error}
          </div>
        )}

        {KAKAO_KEY && (
          <button
            type="button"
            onClick={handleKakao}
            disabled={loading}
            className="w-full py-3.5 px-4 bg-[#FEE500] hover:bg-[#FDD800] text-[#191919] rounded-2xl font-bold text-base transition-all disabled:opacity-50 flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3C6.48 3 2 6.58 2 11c0 2.77 1.58 5.2 4 6.79L5.5 21l3.5-2.06c.94.27 1.92.41 3 .41 5.52 0 10-3.58 10-8s-4.48-8-10-8z"/>
            </svg>
            <span>{t('login_with_kakao', '카카오로 로그인')}</span>
          </button>
        )}

        {NAVER_KEY && (
          <button
            type="button"
            onClick={handleNaver}
            disabled={loading}
            className="w-full py-3.5 px-4 bg-[#03C75A] hover:bg-[#02b350] text-white rounded-2xl font-bold text-base transition-all disabled:opacity-50 flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize="14" fontWeight="bold" fill="white">N</text>
            </svg>
            <span>{t('login_with_naver', '네이버로 로그인')}</span>
          </button>
        )}

        {GOOGLE_KEY && (
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full py-3.5 px-4 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl font-bold text-base transition-all disabled:opacity-50 border border-slate-200 shadow-sm flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>{t('login_with_google', 'Google로 로그인')}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default SocialLoginButtons;
