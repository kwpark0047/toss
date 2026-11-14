import { useState, useEffect, useRef } from 'react';
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
  Camera,
} from 'lucide-react';
import Icon from '../components/ui/Icon';
import UserAvatar from '../components/common/UserAvatar';
import { uploadsAPI } from '../api/misc';

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

const profileSaveError = (error) => {
  const status = error.response?.status;
  if (status === 409) return '이미 다른 계정에서 사용 중인 이메일입니다. 다른 이메일을 입력해 주세요.';
  if (status === 401) return '로그인이 만료되었습니다. 입력 내용을 보관한 뒤 다시 로그인해 주세요.';
  if (status === 403) return '프로필 수정 권한을 확인할 수 없습니다. 다시 로그인해 주세요.';
  if (status >= 500 || error.code === 'ECONNABORTED' || !error.response) return '서버 응답을 확인하지 못했습니다. 입력 내용은 유지됩니다. 잠시 후 다시 저장해 주세요.';
  return '입력 내용을 확인해 주세요. 이메일 형식이나 허용 길이가 올바르지 않을 수 있습니다.';
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
      setFieldError(profileSaveError(e));
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
          ? 'border-orange-300 bg-white shadow-sm'
          : 'border-slate-200 bg-white shadow-sm hover:border-slate-300'
      }`}
    >
      {/* 필드 헤더 */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            editing ? 'bg-orange-50' : 'bg-slate-100'
          }`}
        >
          <Icon className={`w-4 h-4 ${editing ? 'text-orange-600' : 'text-slate-500'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">
            {label}
          </p>
          {!editing && (
            <p
              className={`text-sm font-semibold truncate ${hasValue ? 'text-slate-900' : 'text-slate-500 italic'}`}
            >
              {hasValue ? value : placeholder}
            </p>
          )}
        </div>
        {!editing && !disabled && (
          <button
            onClick={openEdit}
            aria-label={`${label} ${hasValue ? '수정' : '추가'}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 text-xs font-semibold transition-all"
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
              aria-label={label}
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
              className={`w-full px-4 py-3 rounded-xl bg-slate-50 border text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none transition-all ${
                fieldError
                  ? 'border-red-500 focus:border-red-400'
                  : 'border-slate-200 focus:border-orange-500'
              }`}
            />

            {fieldError && (
              <motion.p
                role="alert"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 text-xs text-red-600 font-medium"
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
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-500 hover:text-slate-900 text-xs font-medium rounded-xl transition-all"
              >
                <X className="w-3.5 h-3.5" /> 취소
              </button>
              {/* 기존 값이 있을 때 삭제 버튼 (이름은 삭제 불가) */}
              {hasValue && fieldKey !== 'name' && (
                <button
                  onClick={handleClear}
                  disabled={loading}
                  className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-medium rounded-xl transition-all"
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
          ? 'border-orange-300 bg-white shadow-sm'
          : 'border-slate-200 bg-white shadow-sm hover:border-slate-300'
      }`}
    >
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${open ? 'bg-orange-50' : 'bg-slate-100'}`}
        >
          <Lock className={`w-4 h-4 ${open ? 'text-orange-600' : 'text-slate-500'}`} />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">
            비밀번호
          </p>
          <p className="text-sm font-semibold text-slate-900">••••••••</p>
        </div>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 text-xs font-semibold transition-all"
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
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">{label}</label>
                <div className="relative">
                  <input
                    type={show ? 'text' : 'password'}
                    value={form[key]}
                    onChange={(e) => {
                      setForm((p) => ({ ...p, [key]: e.target.value }));
                      setErrors((p) => ({ ...p, [key]: '' }));
                    }}
                    placeholder={placeholder}
                    className={`w-full px-4 py-3 pr-10 rounded-xl bg-slate-50 border text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none transition-all ${
                      errors[key] ? 'border-red-500' : 'border-slate-200 focus:border-orange-500'
                    }`}
                  />
                  {key === 'current' && (
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                {errors[key] && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-1 flex items-center gap-1 text-xs text-red-600 font-medium"
                  >
                    <AlertCircle className="w-3.5 h-3.5" /> {errors[key]}
                  </motion.p>
                )}
                {/* 실시간 일치 표시 */}
                {key === 'confirm' && form.confirm && !errors.confirm && (
                  <p
                    className={`mt-1 text-xs font-medium ${form.next === form.confirm ? 'text-emerald-600' : 'text-red-600'}`}
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
                className="px-4 py-2.5 bg-slate-100 text-slate-500 hover:text-slate-900 text-xs font-medium rounded-xl transition-all"
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
          ? 'border-orange-300 bg-white shadow-sm'
          : 'border-slate-200 bg-white shadow-sm hover:border-slate-300'
      }`}
    >
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${enabled ? 'bg-emerald-50' : 'bg-slate-100'}`}
        >
          <ShieldCheck className={`w-4 h-4 ${enabled ? 'text-emerald-600' : 'text-slate-500'}`} />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">
            2단계 인증 (2FA)
          </p>
          <p className={`text-sm font-semibold ${enabled ? 'text-emerald-600' : 'text-slate-500'}`}>
            {enabled ? '활성화됨 — 로그인 시 인증번호 필요' : '비활성화됨'}
          </p>
        </div>
        {!open && (
          <button
            onClick={() => startFlow(enabled ? 'DISABLE' : 'ENABLE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              enabled
                ? 'bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700'
                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'
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
            <p className="text-xs text-slate-500">
              {purpose === 'ENABLE' ? '활성화' : '비활성화'} 인증번호가 등록된 핸드폰으로
              전송되었습니다. 6자리를 입력해주세요.
            </p>
            {info && <p className="text-xs text-emerald-600 font-medium">{info}</p>}
            {error && (
              <p className="flex items-center gap-1 text-xs text-red-600 font-medium">
                <AlertCircle className="w-3.5 h-3.5" /> {error}
              </p>
            )}
            {devOtp && (
              <p className="text-[11px] text-amber-600 font-medium">
                개발 모드 인증번호: <span className="font-mono font-bold">{devOtp}</span>
              </p>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">인증번호</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6자리 인증번호"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono font-bold tracking-[0.4em] text-center text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 transition-all"
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
                className="px-3 py-3 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> 재전송
              </button>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-slate-500 hover:text-slate-700 transition-colors font-medium"
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
    refreshProfile,
    changePassword,
    getTwoFactorStatus,
    sendTwoFactorOtp,
    verifyTwoFactorOtp,
  } = useAuth();
  const [toast, setToast] = useState(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorReady, setTwoFactorReady] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState('');
  const [profileError, setProfileError] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef(null);
  const loadProfile = async () => {
    if (!refreshProfile) return;
    try { await refreshProfile(); setProfileError(''); }
    catch { setProfileError('프로필 정보를 불러오지 못했습니다. 다시 시도해 주세요.'); }
  };

  // 마운트 시 2FA 활성화 상태 조회
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    void loadProfile();
    let mounted = true;
    getTwoFactorStatus()
      .then((enabled) => {
        if (mounted) { setTwoFactorEnabled(enabled); setTwoFactorReady(true); }
      })
      .catch(() => { if (mounted) setTwoFactorError('2단계 인증 상태를 확인하지 못했습니다. 페이지를 새로고침해 주세요.'); });
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

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      showToast('JPG, PNG, WebP 또는 GIF 이미지를 선택해 주세요.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('사진은 5MB 이하로 선택해 주세요.', 'error');
      return;
    }

    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await uploadsAPI.uploadImage(formData);
      const uploaded = response.data || response;
      if (!uploaded.url) throw new Error('업로드된 이미지 주소가 없습니다.');
      await updateProfile({ profileImage: uploaded.url });
      showToast('프로필 사진을 저장했습니다.');
    } catch (error) {
      showToast(error.response?.data?.message || '사진을 저장하지 못했습니다. 다시 시도해 주세요.', 'error');
    } finally {
      setAvatarUploading(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarUploading(true);
    try {
      await updateProfile({ profileImage: null });
      showToast('프로필 사진을 삭제했습니다.');
    } catch (error) {
      showToast(error.response?.data?.message || '사진을 삭제하지 못했습니다. 다시 시도해 주세요.', 'error');
    } finally {
      setAvatarUploading(false);
    }
  };

  const filled = [user.name, user.email, user.address].filter(Boolean).length;
  const total = 3;
  const pct = Math.round((filled / total) * 100);

  return (
    <div className="max-w-xl mx-auto py-6 px-2">
      {profileError && <div role="alert" className="mb-4 rounded-xl border border-red-400 p-4 text-red-300">{profileError}<button type="button" className="ml-3 underline" onClick={loadProfile}>다시 시도</button></div>}
      {/* 헤더 */}
      <div className="mb-7 flex items-center gap-4">
        <UserAvatar name={user.name} imageUrl={user.profile_image} className="h-20 w-20 rounded-2xl border border-white/15 bg-slate-700 text-2xl font-bold text-white shadow-lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold text-white tracking-tight">내 프로필</h1>
          <p className="mt-1 truncate text-sm text-slate-300">{user.name || '이름 미설정'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-orange-500 px-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60">
              <Camera className="h-4 w-4" />{avatarUploading ? '저장 중…' : user.profile_image ? '사진 변경' : '로고·사진 등록'}
            </button>
            {user.profile_image && <button type="button" onClick={removeAvatar} disabled={avatarUploading} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-600 px-3 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-60"><Trash2 className="h-4 w-4" />삭제</button>}
          </div>
          <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label="프로필 사진 파일" className="sr-only" onChange={handleAvatarChange} />
          <p className="mt-2 text-xs text-slate-500">JPG, PNG, WebP, GIF · 최대 5MB</p>
        </div>
        <a href="/admin/account-security" className="hidden shrink-0 text-sm text-orange-400 underline sm:block">로그인 수단 연결·보안·회원 탈퇴</a>
      </div>
      <a href="/admin/account-security" className="mb-5 inline-block text-sm text-orange-400 underline sm:hidden">로그인 수단 연결·보안·회원 탈퇴</a>

      {/* 완성률 */}
      <div className="mb-6 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
              프로필 완성도
            </p>
            <p className="text-2xl font-black text-slate-900">
              {pct}
              <span className="text-sm text-slate-500 ml-1">%</span>
            </p>
          </div>
          {pct === 100 ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-xl border border-emerald-200">
              <Check className="w-3.5 h-3.5" /> 완성
            </span>
          ) : (
            <span className="text-xs text-slate-500 font-medium">
              {filled}/{total} 항목
            </span>
          )}
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
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
          placeholder="주소를 추가하세요"
          onSave={saveField('address')}
          onClear={clearField('address')}
        />

        {/* 비밀번호 */}
        <PasswordCard changePassword={handleChangePassword} />

        {/* 2단계 인증 (2FA) */}
        {twoFactorReady ? <TwoFactorCard
          enabled={twoFactorEnabled}
          onSend={handleTwoFactorSend}
          onVerify={handleTwoFactorVerify}
        /> : <p role={twoFactorError ? 'alert' : 'status'} className="p-4 text-sm text-slate-400">{twoFactorError || '2단계 인증 상태 확인 중…'}</p>}
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
