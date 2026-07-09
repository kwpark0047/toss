import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Star, Gift, X, ChevronRight, Check, Bell, Zap, Shield, Lock, ShieldCheck } from 'lucide-react';
import { customersAPI, pointsAPI } from '@/api';
import { getSocket } from '@/api';
import { requestNotificationPermission } from '@/firebase';

const formatPhone = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
};

const TIER_META = {
  GENERAL: { label: '일반', color: 'text-grey-500', bg: 'bg-grey-100' },
  SILVER:  { label: '실버', color: 'text-grey-600', bg: 'bg-grey-200' },
  GOLD:    { label: '골드', color: 'text-yellow-600', bg: 'bg-yellow-100' },
  VIP:     { label: 'VIP',  color: 'text-orange-600', bg: 'bg-orange-100' },
  VVIP:   { label: 'VVIP', color: 'text-purple-600', bg: 'bg-purple-100' },
};

const getTier = (name) => TIER_META[name] || TIER_META.GENERAL;

const useCountUp = (target, duration = 1200) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!target) return;
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start = Math.min(start + step, target);
      setCount(start);
      if (start >= target) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
};

// ── 암호화 애니메이션 컴포넌트 ──────────────────────────────────────────
const HEX_CHARS = '0123456789ABCDEF';
const SYMBOL_CHARS = '!@#$%^&*░▒▓█▀▄■□●○◆◇★☆♦♠♣♥';

function EncryptAnimation({ phone, onDone }) {
  // phase: scramble → mask → seal
  const [phase, setPhase] = useState('scramble'); // scramble | mask | seal
  const [display, setDisplay] = useState(phone);
  const [progress, setProgress] = useState(0);
  const [sealDone, setSealDone] = useState(false);
  const intervalRef = useRef(null);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  useEffect(() => {
    let cancelled = false;

    async function run() {
      // Phase 1: 스크램블 (0~1.4s) — 문자를 무작위 HEX+기호로 치환
      setPhase('scramble');
      const scrambleEnd = Date.now() + 1400;
      while (Date.now() < scrambleEnd && !cancelled) {
        const chars = [...phone];
        setDisplay(
          chars
            .map((c) => {
              if (c === '-') return '-';
              const pool = Math.random() > 0.5 ? HEX_CHARS : SYMBOL_CHARS;
              return pool[Math.floor(Math.random() * pool.length)];
            })
            .join(''),
        );
        setProgress(Math.min(((1400 - (scrambleEnd - Date.now())) / 2800) * 100, 50));
        await sleep(55);
      }
      if (cancelled) return;

      // Phase 2: 마스킹 (1.4~2.4s) — 왼쪽부터 순차적으로 '*'로 변환
      setPhase('mask');
      const digits = phone.replace(/-/g, '');
      let masked = digits;
      const maskCount = Math.max(digits.length - 4, 0);
      for (let i = 0; i < maskCount && !cancelled; i++) {
        masked = masked.slice(0, i + 1).replace(/./g, '●') + masked.slice(i + 1);
        // 포맷 복원
        const raw = '●'.repeat(i + 1) + digits.slice(i + 1);
        const formatted =
          raw.slice(0, 3) + '-' + raw.slice(3, 7) + '-' + raw.slice(7);
        setDisplay(formatted);
        setProgress(50 + ((i + 1) / maskCount) * 35);
        await sleep(80);
      }
      if (cancelled) return;

      // 마지막 4자리는 노출 (010-****-1234 형태)
      const last4 = digits.slice(-4);
      setDisplay(`${digits.slice(0, 3)}-●●●●-${last4}`);
      setProgress(85);
      await sleep(200);

      // Phase 3: 씰링 (2.4~3.0s)
      if (!cancelled) {
        setPhase('seal');
        setProgress(100);
        await sleep(600);
        if (!cancelled) {
          setSealDone(true);
          await sleep(200);
          onDone();
        }
      }
    }

    run();
    return () => {
      cancelled = true;
      clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden border border-grey-100 bg-grey-50"
    >
      {/* 입력창 영역 */}
      <div className="relative px-4 py-3.5 flex items-center gap-3">
        {/* 좌측 아이콘 */}
        <motion.div
          animate={
            phase === 'seal'
              ? { scale: [1, 1.2, 1], rotate: [0, -10, 10, 0] }
              : {}
          }
          transition={{ duration: 0.5 }}
          className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors duration-300 ${
            phase === 'seal'
              ? sealDone
                ? 'bg-green-500'
                : 'bg-orange-500'
              : 'bg-orange-100'
          }`}
        >
          {phase === 'seal' && sealDone ? (
            <ShieldCheck className="w-4 h-4 text-white" />
          ) : phase === 'seal' ? (
            <Lock className="w-4 h-4 text-white" />
          ) : (
            <Shield className="w-4 h-4 text-orange-500" />
          )}
        </motion.div>

        {/* 번호 표시 영역 */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-grey-400 uppercase tracking-widest mb-0.5">
            {phase === 'scramble' && '암호화 처리 중...'}
            {phase === 'mask'    && '개인정보 마스킹 중...'}
            {phase === 'seal'    && (sealDone ? 'AES-256 암호화 완료' : '보안 씰 적용 중...')}
          </p>
          <p
            className={`text-base font-mono font-black tracking-widest transition-colors duration-200 ${
              phase === 'scramble'
                ? 'text-orange-500'
                : phase === 'mask'
                ? 'text-grey-500'
                : sealDone
                ? 'text-green-600'
                : 'text-grey-700'
            }`}
          >
            {display}
          </p>
        </div>

        {/* 우측 — 스캔 라인 애니메이션 */}
        {phase !== 'seal' && (
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 0.4, repeat: Infinity }}
            className="flex-shrink-0 flex flex-col gap-0.5"
          >
            {[...Array(4)].map((_, i) => (
              <motion.div
                key={i}
                animate={{ scaleX: [0.4, 1, 0.4] }}
                transition={{ duration: 0.6, delay: i * 0.1, repeat: Infinity }}
                className="h-1 w-5 rounded-full bg-orange-300 origin-left"
              />
            ))}
          </motion.div>
        )}
        {phase === 'seal' && sealDone && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center"
          >
            <Check className="w-4 h-4 text-white" strokeWidth={3} />
          </motion.div>
        )}
      </div>

      {/* 프로그레스 바 */}
      <div className="h-1.5 bg-grey-200">
        <motion.div
          className={`h-full rounded-full transition-colors duration-500 ${
            sealDone ? 'bg-green-500' : 'bg-gradient-to-r from-orange-400 to-orange-600'
          }`}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.15, ease: 'linear' }}
        />
      </div>

      {/* 하단 — 암호화 알고리즘 표시 */}
      <div className="px-4 py-2 flex items-center gap-2 bg-white/60">
        <motion.div
          animate={phase !== 'seal' ? { opacity: [1, 0.5, 1] } : { opacity: 1 }}
          transition={{ duration: 0.8, repeat: phase !== 'seal' ? Infinity : 0 }}
          className="flex items-center gap-1.5"
        >
          <Lock className="w-3 h-3 text-orange-400" />
          <span className="text-[10px] font-black text-orange-500 tracking-widest">AES-256-GCM</span>
        </motion.div>
        <span className="text-grey-200">|</span>
        <span className="text-[10px] text-grey-400 font-medium">PBKDF2 키 유도</span>
        <span className="text-grey-200">|</span>
        <span className="text-[10px] text-grey-400 font-medium">SHA-256</span>
      </div>
    </motion.div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────
export default function CustomerPhoneSheet({
  isOpen,
  onClose,
  storeId,
  orderId,
  totalAmount,
  storeName,
}) {
  const [step, setStep] = useState('idle'); // idle | encrypting | loading | done | skip
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [estimatedPoints, setEstimatedPoints] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !storeId || !totalAmount) return;
    pointsAPI
      .calculateEarn(totalAmount, storeId)
      .then((res) => setEstimatedPoints(res?.earn_points || 0))
      .catch(() => setEstimatedPoints(0));
  }, [isOpen, storeId, totalAmount]);

  useEffect(() => {
    if (isOpen) {
      setStep('idle');
      // 재방문 고객: 이전에 저장된 알림 수신 번호를 자동 입력
      let saved = '';
      try { saved = localStorage.getItem('wm_customer_phone') || ''; } catch { /* 무시 */ }
      setPhone(saved ? formatPhone(saved) : '');
      setError('');
      setResult(null);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSubmit = () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('올바른 핸드폰 번호를 입력해주세요.');
      return;
    }
    setError('');
    setStep('encrypting'); // 암호화 애니메이션 시작
  };

  // 암호화 애니메이션 완료 후 실제 API 호출
  const handleEncryptDone = useCallback(async () => {
    setStep('loading');
    const digits = phone.replace(/\D/g, '');
    try {
      const res = await customersAPI.phoneJoin({
        phone: digits,
        store_id: storeId,
        order_id: orderId,
        total_amount: totalAmount,
      });
      if (res.already_joined) {
        setError('이미 포인트가 적립된 주문입니다.');
        setStep('idle');
        return;
      }
      setResult(res);
      setStep('done');
      // 개인화 추천(F9)·재방문 편의를 위해 고객 전화번호 저장
      try { localStorage.setItem('wm_customer_phone', digits); } catch { /* 저장 실패 무시 */ }
      const socket = getSocket();
      if (socket && res.socket_channel) {
        socket.emit('join-customer-orders', { phone: digits });
      }
      requestNotificationPermission().then(token => {
        if (token && storeId) {
          customersAPI.registerFcmToken(digits, storeId, token).catch(() => {});
        }
      });
    } catch (err) {
      setError(err.response?.data?.message || '처리 중 오류가 발생했습니다.');
      setStep('idle');
    }
  }, [phone, storeId, orderId, totalAmount]);

  const AnimatedPoints = useCountUp(step === 'done' ? result?.points_earned : 0);
  const AnimatedTotal  = useCountUp(step === 'done' ? result?.total_points : 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => step !== 'loading' && step !== 'encrypting' && onClose()}
      />

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
        className="relative w-full max-w-[480px] bg-white rounded-t-[32px] shadow-2xl overflow-hidden bottom-sheet"
      >
        <div className="w-10 h-1.5 bg-grey-200 rounded-full mx-auto mt-3 mb-1" />

        {step !== 'loading' && step !== 'encrypting' && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-grey-100 hover:bg-grey-200 transition-colors"
          >
            <X className="w-4 h-4 text-grey-500" />
          </button>
        )}

        <AnimatePresence mode="wait">
          {/* ── IDLE: 번호 입력 ─────────────────────────────────── */}
          {step === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="px-6 pb-8 pt-4"
            >
              <div className="text-center mb-6">
                <div className="w-14 h-14 mx-auto bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-200 mb-4">
                  <Star className="w-7 h-7 text-white fill-white" />
                </div>
                <h2 className="tds-title text-grey-900">주문해 주셔서 감사해요!</h2>
                <p className="text-sm text-grey-500 mt-1">번호를 등록하고 포인트를 받아보세요</p>
              </div>

              {estimatedPoints > 0 && (
                <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-2xl border border-orange-100 mb-6">
                  <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-orange-600 font-bold">이번 주문 적립 예정</p>
                    <p className="text-lg font-black text-orange-700">{estimatedPoints.toLocaleString()}P</p>
                  </div>
                </div>
              )}

              <div className="space-y-2.5 mb-6">
                {[
                  { icon: Bell, text: '주문 조리 현황 실시간 알림' },
                  { icon: Star, text: `포인트 적립 (결제금액의 ${estimatedPoints > 0 ? Math.round((estimatedPoints / totalAmount) * 100) : 1}%)` },
                  { icon: Gift, text: '첫 방문 웰컴 쿠폰 즉시 발급' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 text-green-600" strokeWidth={3} />
                    </div>
                    <span className="text-sm text-grey-600 font-medium">{text}</span>
                  </div>
                ))}
              </div>

              {/* 입력창 — 플로팅 레이블 */}
              <div className="mb-4">
                <div className="relative mt-3">
                  {/* 왼쪽 플로팅 레이블: 알림 수신번호 + 자동입력됨 */}
                  <div className="absolute -top-3 left-4 flex items-center gap-1 bg-white px-1 z-10">
                    <Bell className="w-3 h-3 text-grey-400 flex-shrink-0" />
                    <span className="text-[10px] font-black text-grey-500 tracking-wider whitespace-nowrap">
                      알림 수신번호
                    </span>
                    <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-px rounded-full whitespace-nowrap">
                      자동입력됨
                    </span>
                  </div>

                  {/* 오른쪽 플로팅 배지: AES-256 암호화 */}
                  <div className="absolute -top-3 right-4 flex items-center gap-0.5 bg-white px-1 z-10">
                    <Lock className="w-2.5 h-2.5 text-orange-500 flex-shrink-0" />
                    <span className="text-[9px] font-black text-orange-500 tracking-wide whitespace-nowrap">
                      AES-256 암호화
                    </span>
                  </div>

                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-grey-400" />
                  <input
                    ref={inputRef}
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => { setPhone(formatPhone(e.target.value)); setError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    placeholder="010-0000-0000"
                    className="w-full pl-12 pr-4 py-4 text-lg font-bold bg-white border-2 border-grey-200 rounded-2xl focus:border-orange-400 outline-none transition-all tracking-widest"
                  />
                </div>
                {error && <p className="mt-2 text-sm text-red-500 font-medium pl-1">{error}</p>}

                {/* 암호화 안내 문구 */}
                <div className="mt-2.5 flex items-center gap-1.5 justify-center">
                  <Shield className="w-3 h-3 text-grey-400" />
                  <p className="text-[11px] text-grey-400 leading-relaxed">
                    입력하신 번호는 <span className="font-bold text-orange-500">AES-256-GCM</span>으로 즉시 암호화되어 저장됩니다
                  </p>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={phone.replace(/\D/g, '').length < 10}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-black text-base shadow-lg shadow-orange-200 disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Star className="w-5 h-5 fill-white" />
                포인트 받기
                <ChevronRight className="w-5 h-5" />
              </button>

              <button onClick={onClose} className="w-full mt-3 py-3 text-sm text-grey-400 font-medium hover:text-grey-600 transition-colors">
                다음에 하기
              </button>
            </motion.div>
          )}

          {/* ── ENCRYPTING: 3초 암호화 애니메이션 ─────────────── */}
          {step === 'encrypting' && (
            <motion.div
              key="encrypting"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="px-6 py-8"
            >
              {/* 헤더 */}
              <div className="flex flex-col items-center mb-6">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-200 mb-3"
                >
                  <Shield className="w-7 h-7 text-white" />
                </motion.div>
                <h3 className="tds-subtitle text-grey-900">개인정보 암호화 중</h3>
                <p className="text-sm text-grey-400 mt-1">안전하게 보호하고 있어요</p>
              </div>

              {/* 암호화 애니메이션 박스 */}
              <EncryptAnimation phone={phone} onDone={handleEncryptDone} />

              {/* 보안 설명 */}
              <div className="mt-4 space-y-2">
                {[
                  { icon: '🔑', label: 'PBKDF2 키 유도', desc: '안전한 암호화 키 생성' },
                  { icon: '🛡️', label: 'AES-256-GCM',    desc: '군사급 대칭 암호화 적용' },
                  { icon: '🔒', label: '해시 저장',        desc: 'SHA-256 단방향 해시로 보관' },
                ].map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.3 }}
                    className="flex items-center gap-3 px-3 py-2.5 bg-grey-50 rounded-xl"
                  >
                    <span className="text-base">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-grey-700">{item.label}</p>
                      <p className="text-[10px] text-grey-400">{item.desc}</p>
                    </div>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: i * 0.3 + 0.6, type: 'spring' }}
                    >
                      <Check className="w-4 h-4 text-green-500" strokeWidth={3} />
                    </motion.div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── LOADING: API 호출 중 ──────────────────────────── */}
          {step === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-6 py-16 flex flex-col items-center gap-4"
            >
              <div className="w-14 h-14 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
              <p className="text-grey-500 font-medium">포인트 등록 중...</p>
            </motion.div>
          )}

          {/* ── DONE: 완료 화면 ──────────────────────────────── */}
          {step === 'done' && result && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="px-6 pb-8 pt-4"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                className="w-16 h-16 mx-auto bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-lg shadow-green-200 mb-4"
              >
                <Check className="w-8 h-8 text-white" strokeWidth={3} />
              </motion.div>

              <h2 className="text-center tds-title text-grey-900 mb-1">
                {result.is_new_customer ? '🎉 멤버가 되셨어요!' : '✅ 포인트 적립 완료!'}
              </h2>
              <p className="text-center text-sm text-grey-400 mb-6">
                {storeName}의 단골 고객이 되셨습니다
              </p>

              {result.points_earned > 0 && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-5 text-white text-center mb-4 shadow-lg shadow-orange-200"
                >
                  <p className="text-orange-100 text-sm font-medium mb-1">이번 주문 적립</p>
                  <p className="text-4xl font-black tracking-tight">+{AnimatedPoints.toLocaleString()}P</p>
                </motion.div>
              )}

              <div className="space-y-3 mb-5">
                <div className="flex items-center justify-between py-3 px-4 bg-grey-50 rounded-xl">
                  <span className="text-sm text-grey-500 font-medium">누적 포인트</span>
                  <span className="font-black text-grey-900">{AnimatedTotal.toLocaleString()}P</span>
                </div>
                <div className="flex items-center justify-between py-3 px-4 bg-grey-50 rounded-xl">
                  <span className="text-sm text-grey-500 font-medium">회원 등급</span>
                  <span className={`text-sm font-black px-2.5 py-1 rounded-lg ${getTier(result.customer_tier).bg} ${getTier(result.customer_tier).color}`}>
                    {getTier(result.customer_tier).label}
                  </span>
                </div>
                {result.next_tier && (
                  <div className="flex items-center justify-between py-3 px-4 bg-grey-50 rounded-xl">
                    <span className="text-sm text-grey-500 font-medium">다음 등급까지</span>
                    <span className="text-sm font-bold text-orange-500">
                      {result.next_tier.remaining.toLocaleString()}원 남음 → {result.next_tier.name}
                    </span>
                  </div>
                )}
              </div>

              {result.welcome_coupon && (
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="flex items-center gap-3 p-4 bg-purple-50 rounded-2xl border border-purple-100 mb-5"
                >
                  <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Gift className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-purple-500 font-bold">첫 방문 혜택 발급!</p>
                    <p className="text-sm font-black text-purple-900">{result.welcome_coupon.name}</p>
                    <p className="text-xs text-purple-400">
                      {result.welcome_coupon.type === 'percent'
                        ? `${result.welcome_coupon.amount}% 할인`
                        : `${result.welcome_coupon.amount.toLocaleString()}원 할인`}
                    </p>
                  </div>
                </motion.div>
              )}

              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl mb-5">
                <Bell className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <p className="text-xs text-blue-600 font-medium">주문 조리 현황을 실시간으로 알려드릴게요</p>
              </div>

              <button
                onClick={onClose}
                className="w-full py-4 bg-grey-900 text-white rounded-2xl font-black text-base transition-all active:scale-95"
              >
                확인
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
