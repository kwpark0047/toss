import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Lock,
  Check,
  Edit2,
  X,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  Trash2,
  Save,
  RefreshCw,
} from 'lucide-react';
import Icon from '../components/ui/Icon';

/* ──────────────────────────────────────────────
   유틸
────────────────────────────────────────────── */
const formatPhoneDisplay = (phone) => {
  if (!phone) return '';
  const d = phone.replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return phone;
};

const validate = {
  name: (v) => {
    if (!v || !v.trim()) return '이름을 입력해주세요.';
    if (v.trim().length < 2) return '이름은 최소 2자 이상이어야 합니다.';
    return null;
  },
  email: (v) => {
    if (!v || !v.trim()) return null; // 이메일은 선택 사항
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return '올바른 이메일 형식을 입력해주세요.';
    return null;
  },
  address: () => null,
};

/* ──────────────────────────────────────────────
   토스트
────────────────────────────────────────────── */
const Toast = ({ message, type }) => (
  <motion.div
    initial={{ opacity: 0, y: 20, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 20, scale: 0.95 }}
    className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-2xl text-sm font-bold backdrop-blur-xl border ${
      type === 'success'
        ? 'bg-emerald-500/90 text-white border-emerald-400/30'
        : 'bg-red-500/90 text-white border-red-400/30'
    }`}
  >
    {type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
    {message}
  </motion.div>
);

/* ──────────────────────────────────────────────
   프로필 필드 카드
────────────────────────────────────────────── */
const ProfileField = ({
  icon: Icon,
  label,
  fieldKey,
  value,
  placeholder,
  type = 'text',
  disabled = false,
  onSave,
  onClear,
}) => {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [loading, setLoading] = useState(false);

  const hasValue = Boolean(value);

  const openEdit = () => {
    setInput(value || '');
    setFieldError('');
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setFieldError('');
  };

  const handleSave = async () => {
    const trimmed = input.trim();
    const err = validate[fieldKey]?.(trimmed);
    if (err) {
      setFieldError(err);
      return;
    }
    if (trimmed === (value || '')) {
      setEditing(false);
      return;
    }
    setLoading(true);
    try {
      await onSave(trimmed || null);
      setEditing(false);
    } catch (e) {
      setFieldError(e.response?.data?.message || '저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    setLoading(true);
    try {
      await onClear();
      setEditing(false);
    } catch (e) {
      setFieldError(e.response?.data?.message || '삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        editing
          ? 'border-orange-500/50 bg-slate-800/60'
          : 'border-white/5 bg-slate-900/50 hover:border-white/10'
      }`}
    >
      {/* 필드 헤더 */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            editing ? 'bg-orange-500/20' : 'bg-white/5'
          }`}
        >
          <Icon className={`w-4 h-4 ${editing ? 'text-orange-400' : 'text-slate-400'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">
            {label}
          </p>
          {!editing && (
            <p
              className={`text-sm font-semibold truncate ${hasValue ? 'text-white' : 'text-slate-600 italic'}`}
            >
              {hasValue ? value : placeholder}
            </p>
          )}
        </div>
        {!editing && !disabled && (
          <button
            onClick={openEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 text-xs font-semibold transition-all"
          >
            <Edit2 className="w-3 h-3" />
            {hasValue ? '수정' : '추가'}
          </button>
        )}
        {disabled && (
          <span className="flex items-center gap-1 text-xs text-emerald-500 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" /> 인증됨
          </span>
        )}
      </div>

      {/* 편집 영역 */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-5 pb-4 space-y-3"
          >
            <input
              type={type}
              value={input}
              autoFocus
              onChange={(e) => {
                setInput(e.target.value);
                setFieldError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') handleCancel();
              }}
              placeholder={placeholder}
              className={`w-full px-4 py-3 rounded-xl bg-slate-800 border text-sm font-medium text-white placeholder-slate-600 focus:outline-none transition-all ${
                fieldError
                  ? 'border-red-500 focus:border-red-400'
                  : 'border-white/10 focus:border-orange-500'
              }`}
            />

            {fieldError && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 text-xs text-red-400 font-medium"
              >
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {fieldError}
              </motion.p>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" /> 저장
                  </>
                )}
              </button>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 bg-white/5 text-slate-400 hover:text-white text-xs font-medium rounded-xl transition-all"
              >
                <X className="w-3.5 h-3.5" /> 취소
              </button>
              {/* 기존 값이 있을 때 삭제 버튼 (이름은 삭제 불가) */}
              {hasValue && fieldKey !== 'name' && (
                <button
                  onClick={handleClear}
                  disabled={loading}
                  className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium rounded-xl transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" /> 삭제
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ──────────────────────────────────────────────
   비밀번호 변경 카드
────────────────────────────────────────────── */
const PasswordCard = ({ changePassword }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const e = {};
    if (!form.current) e.current = '현재 비밀번호를 입력해주세요.';
    if (!form.next) e.next = '새 비밀번호를 입력해주세요.';
    else if (form.next.length < 6) e.next = '새 비밀번호는 최소 6자 이상이어야 합니다.';
    if (!form.confirm) e.confirm = '새 비밀번호를 다시 입력해주세요.';
    else if (form.next !== form.confirm) e.confirm = '새 비밀번호가 일치하지 않습니다.';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const e2 = validateForm();
    if (Object.keys(e2).length) {
      setErrors(e2);
      return;
    }

    setLoading(true);
    try {
      await changePassword(form.current, form.next);
      setForm({ current: '', next: '', confirm: '' });
      setErrors({});
      setOpen(false);
      // 성공 토스트는 부모에서 처리
    } catch (err) {
      setErrors({ current: err.response?.data?.message || '비밀번호 변경에 실패했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: 'current', label: '현재 비밀번호', placeholder: '현재 비밀번호 입력' },
    { key: 'next', label: '새 비밀번호', placeholder: '최소 6자 이상' },
    { key: 'confirm', label: '새 비밀번호 확인', placeholder: '새 비밀번호 재입력' },
  ];

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        open
          ? 'border-orange-500/50 bg-slate-800/60'
          : 'border-white/5 bg-slate-900/50 hover:border-white/10'
      }`}
    >
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${open ? 'bg-orange-500/20' : 'bg-white/5'}`}
        >
          <Lock className={`w-4 h-4 ${open ? 'text-orange-400' : 'text-slate-400'}`} />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">
            비밀번호
          </p>
          <p className="text-sm font-semibold text-white">••••••••</p>
        </div>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 text-xs font-semibold transition-all"
          >
            <Edit2 className="w-3 h-3" /> 변경
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.form
            onSubmit={handleSubmit}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-5 pb-4 space-y-3"
          >
            {fields.map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">{label}</label>
                <div className="relative">
                  <input
                    type={show ? 'text' : 'password'}
                    value={form[key]}
                    onChange={(e) => {
                      setForm((p) => ({ ...p, [key]: e.target.value }));
                      setErrors((p) => ({ ...p, [key]: '' }));
                    }}
                    placeholder={placeholder}
                    className={`w-full px-4 py-3 pr-10 rounded-xl bg-slate-800 border text-sm font-medium text-white placeholder-slate-600 focus:outline-none transition-all ${
                      errors[key] ? 'border-red-500' : 'border-white/10 focus:border-orange-500'
                    }`}
                  />
                  {key === 'current' && (
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                {errors[key] && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-1 flex items-center gap-1 text-xs text-red-400 font-medium"
                  >
                    <AlertCircle className="w-3.5 h-3.5" /> {errors[key]}
                  </motion.p>
                )}
                {/* 실시간 일치 표시 */}
                {key === 'confirm' && form.confirm && !errors.confirm && (
                  <p
                    className={`mt-1 text-xs font-medium ${form.next === form.confirm ? 'text-emerald-400' : 'text-red-400'}`}
                  >
                    {form.next === form.confirm
                      ? '✓ 비밀번호가 일치합니다'
                      : '비밀번호가 일치하지 않습니다'}
                  </p>
                )}
              </div>
            ))}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" /> 변경 완료
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setErrors({});
                  setForm({ current: '', next: '', confirm: '' });
                }}
                className="px-4 py-2.5 bg-white/5 text-slate-400 hover:text-white text-xs font-medium rounded-xl transition-all"
              >
                취소
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ──────────────────────────────────────────────
   2단계 인증 (2FA) 카드
────────────────────────────────────────────── */
const TwoFactorCard = ({ enabled, onSend, onVerify }) => {
  const [open, setOpen] = useState(false);
  const [purpose, setPurpose] = useState('ENABLE');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const startFlow = async (p) => {
    setPurpose(p);
    setOtp('');
    setError('');
    setInfo('');
    setDevOtp('');
    setOpen(true);
    setSending(true);
    try {
      const res = await onSend(p);
      if (res?.dev_otp) setDevOtp(res.dev_otp);
      setInfo(
        res?.message ||
          (p === 'ENABLE'
            ? '활성화 인증번호가 발송되었습니다.'
            : '비활성화 인증번호가 발송되었습니다.')
      );
    } catch (err) {
      setError(err.response?.data?.message || '인증번호 발송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (otp.trim().length < 6) {
      setError('인증번호 6자리를 입력해주세요.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onVerify(purpose, otp.trim());
      setOpen(false);
    } catch (err) {
      setError(err.response?.data?.message || '인증에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setSending(true);
    setError('');
    try {
      const res = await onSend(purpose);
      if (res?.dev_otp) setDevOtp(res.dev_otp);
      setInfo(res?.message || '인증번호가 재발송되었습니다.');
    } catch (err) {
      setError(err.response?.data?.message || '재발송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        open
          ? 'border-orange-500/50 bg-slate-800/60'
          : 'border-white/5 bg-slate-900/50 hover:border-white/10'
      }`}
    >
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${enabled ? 'bg-emerald-500/20' : 'bg-white/5'}`}
        >
          <ShieldCheck className={`w-4 h-4 ${enabled ? 'text-emerald-400' : 'text-slate-400'}`} />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">
            2단계 인증 (2FA)
          </p>
          <p className={`text-sm font-semibold ${enabled ? 'text-emerald-400' : 'text-slate-500'}`}>
            {enabled ? '활성화됨 — 로그인 시 인증번호 필요' : '비활성화됨'}
          </p>
        </div>
        {!open && (
          <button
            onClick={() => startFlow(enabled ? 'DISABLE' : 'ENABLE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              enabled
                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300'
                : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300'
            }`}
          >
            <ShieldCheck className="w-3 h-3" /> {enabled ? '비활성화' : '활성화'}
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.form
            onSubmit={handleVerify}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-5 pb-4 space-y-3"
          >
            <p className="text-xs text-slate-400">
              {purpose === 'ENABLE' ? '활성화' : '비활성화'} 인증번호가 등록된 핸드폰으로
              전송되었습니다. 6자리를 입력해주세요.
            </p>
            {info && <p className="text-xs text-emerald-400 font-medium">{info}</p>}
            {error && (
              <p className="flex items-center gap-1 text-xs text-red-400 font-medium">
                <AlertCircle className="w-3.5 h-3.5" /> {error}
              </p>
            )}
            {devOtp && (
              <p className="text-[11px] text-amber-400 font-medium">
                개발 모드 인증번호: <span className="font-mono font-bold">{devOtp}</span>
              </p>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">인증번호</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6자리 인증번호"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-white/10 text-sm font-mono font-bold tracking-[0.4em] text-center text-white placeholder-slate-600 focus:outline-none focus:border-orange-500 transition-all"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={loading || sending}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-bold transition-all disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {purpose === 'ENABLE' ? '활성화 확인' : '비활성화 확인'}
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={sending}
                className="px-3 py-3 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> 재전송
              </button>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors font-medium"
              >
                취소
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ──────────────────────────────────────────────
   메인 페이지
────────────────────────────────────────────── */
const ProfilePage = () => {
  const {
    user,
    updateProfile,
    changePassword,
    getTwoFactorStatus,
    sendTwoFactorOtp,
    verifyTwoFactorOtp,
  } = useAuth();
  const [toast, setToast] = useState(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  // 마운트 시 2FA 활성화 상태 조회
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    let mounted = true;
    getTwoFactorStatus()
      .then((enabled) => {
        if (mounted) setTwoFactorEnabled(enabled);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  if (!user) return null;

  const saveField = (key) => async (value) => {
    await updateProfile({ [key]: value });
    showToast(`${key === 'name' ? '이름' : key === 'email' ? '이메일' : '주소'}이 저장되었습니다.`);
  };

  const clearField = (key) => async () => {
    await updateProfile({ [key]: null });
    showToast(`${key === 'email' ? '이메일' : '주소'}이 삭제되었습니다.`);
  };

  const handleChangePassword = async (current, next) => {
    await changePassword(current, next);
    showToast('비밀번호가 변경되었습니다.');
  };

  const handleTwoFactorSend = async (purpose) => {
    const res = await sendTwoFactorOtp(purpose);
    return res;
  };

  const handleTwoFactorVerify = async (purpose, otp) => {
    const enabled = await verifyTwoFactorOtp(purpose, otp);
    setTwoFactorEnabled(enabled);
    showToast(`2FA가 ${purpose === 'ENABLE' ? '활성화' : '비활성화'}되었습니다.`);
  };

  const filled = [user.name, user.email, user.address].filter(Boolean).length;
  const total = 3;
  const pct = Math.round((filled / total) * 100);

  return (
    <div className="max-w-xl mx-auto py-6 px-2">
      {/* 헤더 */}
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">내 프로필</h1>
        <p className="text-slate-400 text-sm mt-1">
          이름, 이메일 등 추가 정보는 언제든지 설정할 수 있어요
        </p>
      </div>

      {/* 완성률 */}
      <div className="mb-6 p-5 rounded-2xl bg-slate-900/70 border border-white/5">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
              프로필 완성도
            </p>
            <p className="text-2xl font-black text-white">
              {pct}
              <span className="text-sm text-slate-400 ml-1">%</span>
            </p>
          </div>
          {pct === 100 ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl border border-emerald-500/20">
              <Check className="w-3.5 h-3.5" /> 완성
            </span>
          ) : (
            <span className="text-xs text-slate-500 font-medium">
              {filled}/{total} 항목
            </span>
          )}
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-orange-500' : 'bg-rose-500'}`}
          />
        </div>
        {pct < 100 && (
          <p className="mt-3 text-xs text-slate-500">
            미입력:{' '}
            {[!user.name && '이름', !user.email && '이메일', !user.address && '주소']
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </div>

      {/* 필드 목록 */}
      <div className="space-y-2.5">
        {/* 핸드폰 — 읽기전용 */}
        <ProfileField
          icon={Phone}
          label="핸드폰 번호"
          fieldKey="phone"
          value={formatPhoneDisplay(user.phone)}
          placeholder="인증된 번호"
          disabled
          onSave={() => {}}
          onClear={() => {}}
        />

        {/* 이름 */}
        <ProfileField
          icon={User}
          label="이름"
          fieldKey="name"
          value={user.name}
          placeholder="이름을 추가하세요"
          onSave={saveField('name')}
          onClear={() => {}}
        />

        {/* 이메일 */}
        <ProfileField
          icon={Mail}
          label="이메일"
          fieldKey="email"
          value={user.email}
          placeholder="이메일을 추가하세요 (선택)"
          type="email"
          onSave={saveField('email')}
          onClear={clearField('email')}
        />

        {/* 주소 */}
        <ProfileField
          icon={MapPin}
          label="주소"
          fieldKey="address"
          value={user.address}
          placeholder="주소를 추가하세요 (선택)"
          onSave={saveField('address')}
          onClear={clearField('address')}
        />

        {/* 비밀번호 */}
        <PasswordCard changePassword={handleChangePassword} />

        {/* 2단계 인증 (2FA) */}
        <TwoFactorCard
          enabled={twoFactorEnabled}
          onSend={handleTwoFactorSend}
          onVerify={handleTwoFactorVerify}
        />
      </div>

      {/* 가입일 */}
      <p className="mt-6 text-center text-xs text-slate-600">
        가입일{' '}
        {user.created_at
          ? new Date(user.created_at).toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : '-'}
      </p>

      {/* 토스트 */}
      <AnimatePresence>
        {toast && <Toast key={toast.message} message={toast.message} type={toast.type} />}
      </AnimatePresence>
    </div>
  );
};

export default ProfilePage;
