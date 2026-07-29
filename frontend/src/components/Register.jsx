import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { Store, Phone, Lock, ShieldCheck, ArrowRight, Check, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STEPS = [
  { id: 1, label: '핸드폰', icon: Phone },
  { id: 2, label: '인증', icon: ShieldCheck },
  { id: 3, label: '비밀번호', icon: Lock },
];

const OTP_EXPIRE_SEC = 300; // 5분

const formatPhone = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
};

const Register = () => {
  const { sendOtp, verifyOtp, register } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  // Step 1
  const [phone, setPhone] = useState('');

  // Step 2 — OTP
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(0);
  const [devOtp, setDevOtp] = useState('');
  const otpRefs = useRef([]);

  // Step 3
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  // OTP 타이머
  useEffect(() => {
    if (timer <= 0) return;
    const id = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  const timerLabel = `${String(Math.floor(timer / 60)).padStart(2, '0')}:${String(timer % 60).padStart(2, '0')}`;

  const slideVariants = {
    enter: { x: 40, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -40, opacity: 0 },
  };

  // ── Step 1: 핸드폰 번호 입력 → OTP 발송 ──
  const handleSendOtp = async (e) => {
    e?.preventDefault();
    setError('');

    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) return setError('올바른 핸드폰 번호를 입력해주세요.');

    setLoading(true);
    setLoadingMsg('인증번호 발송 중...');
    // 3초 후에도 로딩 중이면 서버 웨이크업 안내
    const slowTimer = setTimeout(() => setLoadingMsg('서버 시작 중입니다. 잠시만 기다려주세요...'), 3000);
    try {
      const res = await sendOtp(phone);
      if (res?.dev_otp) setDevOtp(res.dev_otp);
      setTimer(OTP_EXPIRE_SEC);
      setOtp(['', '', '', '', '', '']);
      setStep(2);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      const isNetwork = !err.response && (err.code === 'ERR_NETWORK' || err.message === 'Network Error');
      setError(
        err.response?.data?.message ||
        (isNetwork ? '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.' : err.message) ||
        '인증번호 발송에 실패했습니다.'
      );
    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
      setLoadingMsg('');
    }
  };

  // OTP 입력 처리
  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      otpRefs.current[5]?.focus();
    }
    e.preventDefault();
  };

  // ── Step 2: OTP 검증 ──
  const handleVerifyOtp = async () => {
    setError('');
    const otpValue = otp.join('');
    if (otpValue.length !== 6) return setError('6자리 인증번호를 모두 입력해주세요.');
    if (timer <= 0) return setError('인증번호가 만료되었습니다. 다시 요청해주세요.');

    setLoading(true);
    try {
      await verifyOtp(phone, otpValue);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || '인증번호가 올바르지 않습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 재발송
  const handleResendOtp = async () => {
    setError('');
    setDevOtp('');
    setLoading(true);
    try {
      const res = await sendOtp(phone);
      if (res?.dev_otp) setDevOtp(res.dev_otp);
      setTimer(OTP_EXPIRE_SEC);
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      const isNetwork = !err.response && (err.code === 'ERR_NETWORK' || err.message === 'Network Error');
      setError(
        err.response?.data?.message ||
        (isNetwork ? '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.' : '재발송에 실패했습니다.')
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: 비밀번호 설정 → 가입 완료 ──
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) return setError('비밀번호는 최소 6자 이상이어야 합니다.');
    if (password !== confirmPassword) return setError('비밀번호가 일치하지 않습니다.');

    setLoading(true);
    try {
      await register({ phone, password });
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || '회원가입에 실패했습니다.');
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
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md z-10"
      >
        <div className="bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-white p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-orange-400 to-orange-600" />

          {/* 헤더 */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
              className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-[0_10px_25px_rgba(249,115,22,0.3)] mb-4"
            >
              <Store className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">위마켓 가입</h1>
          </div>

          {/* 스텝 인디케이터 */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  step > s.id
                    ? 'bg-orange-500 text-white'
                    : step === s.id
                    ? 'bg-orange-100 text-orange-600 ring-2 ring-orange-500'
                    : 'bg-slate-100 text-slate-400'
                }`}>
                  {step > s.id ? <Check className="w-4 h-4" /> : s.id}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-8 h-0.5 transition-all duration-300 ${step > s.id ? 'bg-orange-500' : 'bg-slate-200'}`} />
                )}
              </div>
            ))}
          </div>

          {/* 에러 */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-5 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">

            {/* ── Step 1: 핸드폰 번호 ── */}
            {step === 1 && (
              <motion.form
                key="step1"
                variants={slideVariants}
                initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.3 }}
                onSubmit={handleSendOtp}
                className="space-y-5"
              >
                <div>
                  <p className="text-lg font-bold text-slate-800 mb-1">핸드폰 번호로 시작하세요</p>
                  <p className="text-sm text-slate-500 mb-5">번호만으로 간편하게 가입할 수 있어요</p>

                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    핸드폰 번호 <span className="text-orange-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(formatPhone(e.target.value))}
                      required
                      autoFocus
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none font-medium text-slate-900 transition-all"
                      placeholder="010-1234-5678"
                    />
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.01, translateY: -1 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-bold text-base shadow-[0_10px_20px_rgba(249,115,22,0.2)] hover:shadow-[0_15px_30px_rgba(249,115,22,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {loadingMsg || '처리 중...'}
                    </span>
                  ) : (
                    <>인증번호 받기 <ArrowRight className="w-4 h-4" /></>
                  )}
                </motion.button>

                    {/* 개발 모드: OTP 인증 건너뛰기 (BYPASS_OTP=true 필요) */}
                    {window.location.hostname === 'localhost' && (
                      <button
                        type="button"
                        onClick={() => { setError(''); setStep(3); }}
                        className="w-full text-center text-sm text-slate-400 hover:text-slate-600 font-medium transition-colors mt-2"
                      >
                        인증 없이 바로 가입하기 (개발 모드)
                      </button>
                    )}
              </motion.form>
            )}

            {/* ── Step 2: OTP 입력 ── */}
            {step === 2 && (
              <motion.div
                key="step2"
                variants={slideVariants}
                initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.3 }}
                className="space-y-5"
              >
                <div>
                  <p className="text-lg font-bold text-slate-800 mb-1">인증번호를 입력하세요</p>
                  <p className="text-sm text-slate-500 mb-1">
                    <span className="font-semibold text-slate-700">{phone}</span>으로 발송되었습니다
                  </p>

                  {/* 개발 환경 OTP 힌트 */}
                  {devOtp && (
                    <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-medium">
                      [개발 모드] 인증번호: <span className="font-mono font-bold text-amber-900">{devOtp}</span>
                    </div>
                  )}

                  {/* 6칸 OTP 입력 */}
                  <div className="flex gap-2 justify-center mt-4" onPaste={handleOtpPaste}>
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => (otpRefs.current[i] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        className="w-11 h-14 text-center text-xl font-bold bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10 outline-none transition-all text-slate-900"
                      />
                    ))}
                  </div>

                  {/* 타이머 + 재발송 */}
                  <div className="flex items-center justify-between mt-4">
                    <span className={`text-sm font-mono font-semibold ${timer <= 60 ? 'text-red-500' : 'text-slate-500'}`}>
                      {timer > 0 ? timerLabel : '만료됨'}
                    </span>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={loading}
                      className="flex items-center gap-1 text-sm text-orange-600 font-semibold hover:text-orange-700 disabled:opacity-50 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      재발송
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setError(''); setStep(1); }}
                    className="flex-1 py-3.5 bg-slate-100 text-slate-500 rounded-2xl font-medium hover:bg-slate-200 transition-colors text-sm"
                  >
                    이전
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={loading || otp.join('').length !== 6}
                    className="flex-1 py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-bold shadow-[0_8px_15px_rgba(249,115,22,0.2)] transition-all disabled:opacity-50 flex items-center justify-center gap-1 text-sm"
                  >
                    {loading
                      ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <>확인 <Check className="w-4 h-4" /></>
                    }
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* ── Step 3: 비밀번호 설정 ── */}
            {step === 3 && (
              <motion.form
                key="step3"
                variants={slideVariants}
                initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.3 }}
                onSubmit={handleRegister}
                className="space-y-5"
              >
                <div>
                  <p className="text-lg font-bold text-slate-800 mb-1">비밀번호를 설정하세요</p>
                  <p className="text-sm text-slate-500 mb-5">로그인에 사용할 비밀번호를 입력해 주세요</p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        비밀번호 <span className="text-orange-500">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type={showPw ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          autoFocus
                          className="w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none font-medium text-slate-900 transition-all"
                          placeholder="최소 6자 이상"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw((v) => !v)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-medium"
                        >
                          {showPw ? '숨기기' : '보기'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        비밀번호 확인 <span className="text-orange-500">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type={showPw ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none font-medium text-slate-900 transition-all"
                          placeholder="비밀번호 재입력"
                        />
                      </div>
                      {/* 실시간 일치 여부 */}
                      {confirmPassword && (
                        <p className={`mt-1.5 text-xs font-medium ${password === confirmPassword ? 'text-emerald-600' : 'text-red-500'}`}>
                          {password === confirmPassword ? '✓ 비밀번호가 일치합니다' : '비밀번호가 일치하지 않습니다'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.01, translateY: -1 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading || !password || password !== confirmPassword}
                  className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-bold text-base shadow-[0_10px_20px_rgba(249,115,22,0.2)] hover:shadow-[0_15px_30px_rgba(249,115,22,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>가입 완료 <Check className="w-4 h-4" /></>
                  )}
                </motion.button>

                <p className="text-center text-xs text-slate-400">
                  이름, 이메일 등 추가 정보는 가입 후 프로필에서 설정할 수 있어요
                </p>
              </motion.form>
            )}

          </AnimatePresence>

          {step === 1 && (
            <div className="mt-8 pt-6 border-t border-slate-50 text-center">
              <p className="text-slate-500 text-sm font-medium">
                이미 계정이 있으신가요?{' '}
                <Link to="/login" className="text-orange-600 font-bold hover:text-orange-700 transition-colors">
                  로그인
                </Link>
              </p>
            </div>
          )}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-6 text-center text-slate-400 text-xs font-medium"
        >
          &copy; 2024 WeMarket. All rights reserved.
        </motion.p>
      </motion.div>
    </div>
  );
};

export default Register;
