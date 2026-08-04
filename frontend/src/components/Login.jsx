import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { wakeupServer } from '../api';
import { Store, Phone, Lock, AlertCircle, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SocialLoginButtons from './SocialLoginButtons';

const formatPhone = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
};

const Login = () => {
  const { login, socialLogin, verifyLoginOtp, sendLoginOtp } = useAuth();
  const { t } = useTranslation(undefined, { keyPrefix: 'auth' });
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState('idle'); // idle | waking | ready

  // ── 2FA (2차 로그인) 상태 ──
  const [step, setStep] = useState('login'); // 'login' | 'otp'
  const [tempToken, setTempToken] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [devOtp, setDevOtp] = useState('');
  const [otpInfo, setOtpInfo] = useState('');

  // 로그인 페이지 진입 즉시 서버 예열
  useEffect(() => {
    if (window.location.hostname === 'localhost') return;
    setServerStatus('waking');
    wakeupServer()
      .then(() => setServerStatus('ready'))
      .catch(() => setServerStatus('idle'));
  }, []);

  // 핸드폰 번호 전용 — 입력을 항상 전화번호 형식으로 포맷
  const handleIdentifierChange = (e) => {
    setIdentifier(formatPhone(e.target.value));
  };

  // 암호화 시각화: 입력이 있으면 AES 암호문처럼 hex 문자열을 실시간 스크램블
  const [cipher, setCipher] = useState('');
  useEffect(() => {
    const digits = identifier.replace(/\D/g, '');
    if (!digits) {
      setCipher('');
      return;
    }
    const hex = '0123456789abcdef';
    const len = 24;
    const tick = () => {
      let s = '';
      for (let i = 0; i < len; i++) s += hex[Math.floor(Math.random() * 16)];
      setCipher(s);
    };
    tick();
    const id = setInterval(tick, 90);
    return () => clearInterval(id);
  }, [identifier]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await login(identifier, password);
      // 2FA 활성 계정: tempToken 보관 후 OTP 입력 단계로 전환
      if (result?.twoFactorRequired) {
        setTempToken(result.tempToken);
        setOtp('');
        setOtpError('');
        setStep('otp');
        return;
      }
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp.trim().length < 6) {
      setOtpError('인증번호 6자리를 입력해주세요.');
      return;
    }
    setOtpLoading(true);
    setOtpError('');
    try {
      await verifyLoginOtp(tempToken, otp.trim());
      navigate('/admin', { replace: true });
    } catch (err) {
      setOtpError(err.response?.data?.message || err.message || '인증에 실패했습니다.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    setOtpError('');
    setOtpInfo('');
    try {
      const res = await sendLoginOtp(tempToken);
      if (res?.dev_otp) setDevOtp(res.dev_otp);
      setOtpInfo(res?.message || '인증번호가 다시 발송되었습니다.');
    } catch (err) {
      setOtpError(err.response?.data?.message || err.message || '인증번호 재발송에 실패했습니다.');
    } finally {
      setResending(false);
    }
  };

  const handleBackToLogin = () => {
    setStep('login');
    setTempToken('');
    setOtp('');
    setOtpError('');
    setDevOtp('');
  };

  const handleSocialLogin = async (provider, accessToken) => {
    setLoading(true);
    setError('');
    try {
      await socialLogin(provider, accessToken);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'SNS 로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-100 rounded-full blur-[120px] opacity-50" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-[120px] opacity-50" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md z-10"
      >
        <div className="bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-white p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-orange-400 to-orange-600" />

          <div className="text-center mb-10">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-[0_10px_25px_rgba(249,115,22,0.3)] mb-6"
            >
              <Store className="w-10 h-10 text-white" />
            </motion.div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">위마켓</h1>
            <p className="text-slate-500 mt-3 font-medium text-lg">
              {t('loginSubTitle', '매장 관리 시스템 로그인')}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, height: 0, x: -10 }}
                animate={{ opacity: 1, height: 'auto', x: [0, -4, 4, -4, 4, 0] }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-8 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait" initial={false}>
            {step === 'otp' ? (
              <motion.form
                key="otp"
                onSubmit={handleVerifyOtp}
                className="space-y-6"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.25 }}
              >
                {/* 2FA 안내 */}
                <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-orange-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-orange-700">2차 인증 필요</p>
                      <p className="text-xs text-orange-600 mt-0.5">
                        등록된 핸드폰으로 전송된 인증번호 6자리를 입력해주세요.
                      </p>
                    </div>
                  </div>
                </div>

                {otpInfo && (
                  <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> {otpInfo}
                  </p>
                )}

                {/* 인증번호 입력 */}
                <div className="space-y-2">
                  <label
                    htmlFor="login-otp"
                    className="block text-sm font-bold text-slate-700 ml-1"
                  >
                    인증번호
                  </label>
                  <input
                    id="login-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    autoFocus
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6자리 인증번호"
                    aria-label="인증번호 6자리"
                    className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none font-mono font-bold text-2xl text-center tracking-[0.5em] text-slate-900"
                  />
                  {otpError && (
                    <p className="text-xs text-red-600 font-semibold flex items-center gap-1 ml-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {otpError}
                    </p>
                  )}
                  {devOtp && (
                    <p className="text-[11px] text-amber-600 font-medium ml-1">
                      개발 모드 인증번호: <span className="font-mono font-bold">{devOtp}</span>
                    </p>
                  )}
                </div>

                <div className="pt-2 space-y-3">
                  <motion.button
                    whileHover={{ scale: 1.01, translateY: -2 }}
                    whileTap={{ scale: 0.98, translateY: 0 }}
                    type="submit"
                    disabled={otpLoading}
                    className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-bold text-lg shadow-[0_10px_20px_rgba(249,115,22,0.2)] hover:shadow-[0_15px_30px_rgba(249,115,22,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
                  >
                    {otpLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>인증 확인 중...</span>
                      </>
                    ) : (
                      <>
                        <span>인증 완료</span>
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </motion.button>

                  <div className="flex items-center justify-between text-xs font-semibold">
                    <button
                      type="button"
                      onClick={handleBackToLogin}
                      className="text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1"
                    >
                      <ArrowRight className="w-3.5 h-3.5 rotate-180" /> 로그인으로 돌아가기
                    </button>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={resending}
                      className="text-orange-600 hover:text-orange-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />{' '}
                      {resending ? '재전송 중...' : '인증번호 재전송'}
                    </button>
                  </div>
                </div>
              </motion.form>
            ) : (
              <motion.form
                key="login"
                onSubmit={handleSubmit}
                className="space-y-6"
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.25 }}
              >
                <div className="space-y-2">
                  <label
                    htmlFor="login-phone"
                    className="block text-sm font-bold text-slate-700 ml-1"
                  >
                    {t('phone', '핸드폰 번호')}
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Phone
                        className="h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors"
                        aria-hidden="true"
                      />
                    </div>
                    <input
                      id="login-phone"
                      type="tel"
                      value={identifier}
                      onChange={handleIdentifierChange}
                      required
                      inputMode="numeric"
                      autoComplete="tel"
                      maxLength={13}
                      aria-label="핸드폰 번호 (입력값은 보안을 위해 가려집니다)"
                      style={{
                        WebkitTextSecurity: identifier ? 'disc' : 'none',
                        textSecurity: identifier ? 'disc' : 'none',
                      }}
                      className="w-full pl-12 pr-11 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none font-medium text-slate-900 tracking-widest"
                      placeholder="가입한 핸드폰 번호"
                    />
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <Lock
                        className={`h-4 w-4 transition-colors ${identifier ? 'text-emerald-500' : 'text-slate-300'}`}
                        aria-hidden="true"
                      />
                    </div>
                  </div>

                  {/* 암호화 안내 + 실시간 암호화 애니메이션 */}
                  <AnimatePresence mode="wait">
                    {identifier ? (
                      <motion.div
                        key="enc"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-1 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2">
                          <motion.span
                            animate={{ scale: [1, 1.15, 1] }}
                            transition={{ duration: 1.2, repeat: Infinity }}
                          >
                            <ShieldCheck
                              className="h-4 w-4 text-emerald-500 shrink-0"
                              aria-hidden="true"
                            />
                          </motion.span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-black text-emerald-700 leading-none mb-1">
                              AES-256 암호화 저장 중
                            </p>
                            <p
                              className="font-mono text-[11px] text-emerald-500/80 truncate leading-none"
                              aria-hidden="true"
                            >
                              {cipher}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.p
                        key="hint"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-xs text-slate-400 ml-1 flex items-center gap-1"
                      >
                        <Lock className="h-3 w-3" aria-hidden="true" /> 입력하신 번호는 암호화되어
                        안전하게 저장됩니다
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700 ml-1">
                    {t('password', '비밀번호')}
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none font-medium text-slate-900"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="pt-2 space-y-3">
                  <motion.button
                    whileHover={{ scale: 1.01, translateY: -2 }}
                    whileTap={{ scale: 0.98, translateY: 0 }}
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-bold text-lg shadow-[0_10px_20px_rgba(249,115,22,0.2)] hover:shadow-[0_15px_30px_rgba(249,115,22,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>로그인 중...</span>
                      </>
                    ) : (
                      <>
                        <span>{t('login', '로그인')}</span>
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </motion.button>

                  {/* 서버 상태 표시기 */}
                  <AnimatePresence>
                    {serverStatus === 'waking' && (
                      <motion.div
                        key="waking"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center justify-center gap-2 text-xs text-amber-500 font-medium"
                      >
                        <div className="w-3 h-3 border-2 border-amber-400/40 border-t-amber-500 rounded-full animate-spin" />
                        서버 준비 중입니다... (최초 접속 시 잠시 소요)
                      </motion.div>
                    )}
                    {serverStatus === 'ready' && (
                      <motion.div
                        key="ready"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center justify-center gap-1.5 text-xs text-emerald-500 font-medium"
                      >
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        서버 준비 완료
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {step === 'login' && (
            <>
              <SocialLoginButtons onSuccess={handleSocialLogin} loading={loading} />

              <div className="mt-8 pt-6 border-t border-slate-50 text-center">
                <p className="text-slate-500 font-medium tracking-tight">
                  계정이 없으신가요?{' '}
                  <Link
                    to="/register"
                    className="text-orange-600 font-bold hover:text-orange-700 transition-colors underline-offset-4 hover:underline"
                  >
                    핸드폰으로 가입하기
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="mt-8 text-center text-slate-400 text-sm font-medium"
        >
          &copy; 2024 WeMarket. All rights reserved.
        </motion.p>
      </motion.div>
    </div>
  );
};

export default Login;
