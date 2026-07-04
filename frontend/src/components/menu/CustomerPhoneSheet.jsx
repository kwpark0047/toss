import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Star, Gift, X, ChevronRight, Check, Bell, Zap } from 'lucide-react';
import { customersAPI, pointsAPI } from '@/api';
import { getSocket } from '@/api';

const formatPhone = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
};

const TIER_META = {
  GENERAL: { label: '일반', color: 'text-slate-500', bg: 'bg-slate-100' },
  SILVER:  { label: '실버', color: 'text-slate-600', bg: 'bg-slate-200' },
  GOLD:    { label: '골드', color: 'text-yellow-600', bg: 'bg-yellow-100' },
  VIP:     { label: 'VIP',  color: 'text-orange-600', bg: 'bg-orange-100' },
  VVIP:   { label: 'VVIP', color: 'text-purple-600', bg: 'bg-purple-100' },
};

const getTier = (name) => TIER_META[name] || TIER_META.GENERAL;

// 숫자 카운트업 애니메이션
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

export default function CustomerPhoneSheet({
  isOpen,
  onClose,
  storeId,
  orderId,
  totalAmount,
  storeName,
}) {
  const [step, setStep] = useState('idle'); // idle | loading | done | skip
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [estimatedPoints, setEstimatedPoints] = useState(0);
  const inputRef = useRef(null);

  // 예상 적립 포인트 미리 조회
  useEffect(() => {
    if (!isOpen || !storeId || !totalAmount) return;
    pointsAPI
      .calculateEarn(totalAmount, storeId)
      .then((res) => setEstimatedPoints(res?.earn_points || 0))
      .catch(() => setEstimatedPoints(0));
  }, [isOpen, storeId, totalAmount]);

  // 시트가 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      setStep('idle');
      setPhone('');
      setError('');
      setResult(null);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('올바른 핸드폰 번호를 입력해주세요.');
      return;
    }
    setError('');
    setStep('loading');

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

      // Socket.io 주문 알림 채널 구독
      const socket = getSocket();
      if (socket && res.socket_channel) {
        socket.emit('join-customer-orders', { phone: digits });
      }
    } catch (err) {
      setError(err.response?.data?.message || '처리 중 오류가 발생했습니다.');
      setStep('idle');
    }
  };

  const AnimatedPoints = useCountUp(step === 'done' ? result?.points_earned : 0);
  const AnimatedTotal = useCountUp(step === 'done' ? result?.total_points : 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => step !== 'loading' && onClose()}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
        className="relative w-full max-w-lg bg-white rounded-t-[32px] shadow-2xl overflow-hidden"
      >
        {/* 드래그 핸들 */}
        <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-1" />

        {/* 닫기 */}
        {step !== 'loading' && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        )}

        <AnimatePresence mode="wait">
          {/* ── IDLE: 번호 입력 ───────────────────────────────────── */}
          {step === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="px-6 pb-8 pt-4"
            >
              {/* 헤더 */}
              <div className="text-center mb-6">
                <div className="w-14 h-14 mx-auto bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-200 mb-4">
                  <Star className="w-7 h-7 text-white fill-white" />
                </div>
                <h2 className="text-xl font-black text-slate-900">주문해 주셔서 감사해요!</h2>
                <p className="text-sm text-slate-500 mt-1">
                  번호를 등록하고 포인트를 받아보세요
                </p>
              </div>

              {/* 예상 적립 포인트 배너 */}
              {estimatedPoints > 0 && (
                <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-2xl border border-orange-100 mb-6">
                  <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-orange-600 font-bold">이번 주문 적립 예정</p>
                    <p className="text-lg font-black text-orange-700">
                      {estimatedPoints.toLocaleString()}P
                    </p>
                  </div>
                </div>
              )}

              {/* 혜택 목록 */}
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
                    <span className="text-sm text-slate-600 font-medium">{text}</span>
                  </div>
                ))}
              </div>

              {/* 핸드폰 입력 */}
              <div className="mb-3">
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    ref={inputRef}
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => {
                      setPhone(formatPhone(e.target.value));
                      setError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    placeholder="010-0000-0000"
                    className="w-full pl-12 pr-4 py-4 text-lg font-bold bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-orange-500 focus:bg-white outline-none transition-all tracking-widest"
                  />
                </div>
                {error && (
                  <p className="mt-2 text-sm text-red-500 font-medium pl-1">{error}</p>
                )}
                {/* 개인정보 암호화 고지 */}
                <p className="mt-2 text-xs text-slate-400 text-center leading-relaxed">
                  🔒 입력하신 전화번호는 AES-256 암호화되어 안전하게 저장됩니다.
                </p>
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

              <button
                onClick={onClose}
                className="w-full mt-3 py-3 text-sm text-slate-400 font-medium hover:text-slate-600 transition-colors"
              >
                다음에 하기
              </button>
            </motion.div>
          )}

          {/* ── LOADING ──────────────────────────────────────────── */}
          {step === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-6 py-16 flex flex-col items-center gap-4"
            >
              <div className="w-14 h-14 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
              <p className="text-slate-500 font-medium">등록 중입니다...</p>
            </motion.div>
          )}

          {/* ── DONE: 완료 화면 ───────────────────────────────────── */}
          {step === 'done' && result && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="px-6 pb-8 pt-4"
            >
              {/* 성공 아이콘 */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                className="w-16 h-16 mx-auto bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-lg shadow-green-200 mb-4"
              >
                <Check className="w-8 h-8 text-white" strokeWidth={3} />
              </motion.div>

              <h2 className="text-center text-xl font-black text-slate-900 mb-1">
                {result.is_new_customer ? '🎉 멤버가 되셨어요!' : '✅ 포인트 적립 완료!'}
              </h2>
              <p className="text-center text-sm text-slate-400 mb-6">
                {storeName}의 단골 고객이 되셨습니다
              </p>

              {/* 적립 포인트 카드 */}
              {result.points_earned > 0 && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-5 text-white text-center mb-4 shadow-lg shadow-orange-200"
                >
                  <p className="text-orange-100 text-sm font-medium mb-1">이번 주문 적립</p>
                  <p className="text-4xl font-black tracking-tight">
                    +{AnimatedPoints.toLocaleString()}P
                  </p>
                </motion.div>
              )}

              {/* 요약 정보 */}
              <div className="space-y-3 mb-5">
                <div className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-xl">
                  <span className="text-sm text-slate-500 font-medium">누적 포인트</span>
                  <span className="font-black text-slate-900">{AnimatedTotal.toLocaleString()}P</span>
                </div>

                <div className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-xl">
                  <span className="text-sm text-slate-500 font-medium">회원 등급</span>
                  <span className={`text-sm font-black px-2.5 py-1 rounded-lg ${getTier(result.customer_tier).bg} ${getTier(result.customer_tier).color}`}>
                    {getTier(result.customer_tier).label}
                  </span>
                </div>

                {result.next_tier && (
                  <div className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-xl">
                    <span className="text-sm text-slate-500 font-medium">다음 등급까지</span>
                    <span className="text-sm font-bold text-orange-500">
                      {result.next_tier.remaining.toLocaleString()}원 남음 → {result.next_tier.name}
                    </span>
                  </div>
                )}
              </div>

              {/* 웰컴 쿠폰 */}
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

              {/* 알림 채널 등록 안내 */}
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl mb-5">
                <Bell className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <p className="text-xs text-blue-600 font-medium">
                  주문 조리 현황을 실시간으로 알려드릴게요
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-base transition-all active:scale-95"
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
