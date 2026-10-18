import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Store } from 'lucide-react';
import { motion } from 'framer-motion';
import { freeAuthAPI } from '../api/freeAuth';
import { useAuth } from '../contexts/AuthContext';
import TurnstileChallenge from './TurnstileChallenge';

export default function Register() {
  const navigate = useNavigate();
  const { acceptAuthentication } = useAuth();
  const [config, setConfig] = useState(null);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [confirmAge14, setConfirmAge14] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [challengeGeneration, setChallengeGeneration] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    freeAuthAPI.config()
      .then((data) => { if (active) setConfig(data); })
      .catch(() => { if (active) setConfig({ simpleSignup: false }); });
    return () => { active = false; };
  }, []);

  const enabled = Boolean(config?.simpleSignup);
  const canSubmit = enabled && agreeTerms && agreePrivacy && confirmAge14 && turnstileToken && !busy;

  async function submit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      const data = await freeAuthAPI.simpleSignup({
        phone: phone.replace(/[^0-9]/g, ''),
        email,
        password,
        // Keep the current server contract while avoiding a redundant confirmation field.
        passwordConfirm: password,
        agreeTerms,
        agreePrivacy,
        confirmAge14,
        consentVersion: config.signupConsentVersion,
        turnstileToken,
      });
      await acceptAuthentication(data);
      navigate('/admin', { replace: true });
    } catch (cause) {
      setError(cause.response?.data?.message || cause.response?.data?.error || cause.message || '가입을 완료하지 못했습니다.');
      setTurnstileToken(null);
      setChallengeGeneration((value) => value + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f8f9fa] p-4">
      <div aria-hidden="true" className="absolute left-[-10%] top-[-10%] h-[40%] w-[40%] rounded-full bg-orange-100 opacity-50 blur-[120px]" />
      <div aria-hidden="true" className="absolute bottom-[-10%] right-[-10%] h-[40%] w-[40%] rounded-full bg-blue-100 opacity-50 blur-[120px]" />
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="z-10 w-full max-w-md rounded-[2rem] border border-white bg-white p-7 shadow-[0_20px_50px_rgba(0,0,0,0.05)] sm:p-10"
        aria-labelledby="signup-title"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg shadow-orange-500/20">
            <Store aria-hidden="true" className="h-8 w-8 text-white" />
          </div>
          <h1 id="signup-title" className="text-2xl font-extrabold tracking-tight text-slate-900">위마켓 회원가입</h1>
          <p className="mt-2 text-sm text-slate-600">휴대전화번호와 이메일, 비밀번호로 가입하고 1개월 체험을 시작해요. 번호·이메일 소유 인증은 하지 않아요.</p>
        </div>

        {config === null ? (
          <p role="status" className="mb-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">가입 설정을 확인하고 있습니다. 입력란은 미리 작성할 수 있습니다.</p>
        ) : !enabled ? (
          <p role="status" className="mb-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            가입 설정을 준비 중입니다. 입력 내용은 제출되지 않으며, 기존 로그인은 계속 이용할 수 있습니다.
          </p>
        ) : null}
        <form onSubmit={submit} className="space-y-4">
            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <label className="block text-sm font-medium text-slate-700">
              휴대전화번호
              <input aria-label="휴대전화번호" type="tel" autoComplete="tel" inputMode="tel" required maxLength={13} pattern="01[0-9][- ]?[0-9]{3,4}[- ]?[0-9]{4}" title="01012345678 또는 010-1234-5678 형식으로 입력해 주세요." value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              이메일
              <input aria-label="이메일" type="email" autoComplete="email" required maxLength={255} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              비밀번호
              <input aria-label="비밀번호" type="password" autoComplete="new-password" required minLength={8} maxLength={128} pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,128}" title="8자 이상, 영문과 숫자를 포함해 주세요." value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900" />
              <span className="mt-1 block text-xs font-normal text-slate-500">8자 이상, 영문과 숫자를 포함해 주세요.</span>
            </label>

            <fieldset className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              <legend className="sr-only">가입 동의</legend>
              <label className="flex items-start gap-2"><input type="checkbox" checked={agreeTerms} onChange={(event) => setAgreeTerms(event.target.checked)} aria-label="이용약관에 동의합니다" /><span>이용약관에 동의합니다 {config?.termsUrl && <a className="underline" href={config.termsUrl} target="_blank" rel="noreferrer">보기</a>}</span></label>
              <label className="flex items-start gap-2"><input type="checkbox" checked={agreePrivacy} onChange={(event) => setAgreePrivacy(event.target.checked)} aria-label="개인정보 처리방침에 동의합니다" /><span>개인정보 처리방침에 동의합니다 {config?.privacyUrl && <a className="underline" href={config.privacyUrl} target="_blank" rel="noreferrer">보기</a>}</span></label>
              <label className="flex items-start gap-2"><input type="checkbox" checked={confirmAge14} onChange={(event) => setConfirmAge14(event.target.checked)} aria-label="만 14세 이상입니다" /><span>만 14세 이상입니다</span></label>
            </fieldset>
            {config?.turnstileSiteKey && <TurnstileChallenge siteKey={config.turnstileSiteKey} action="signup" onToken={setTurnstileToken} generation={challengeGeneration} />}
            <p className="text-xs leading-relaxed text-slate-500">휴대전화번호와 이메일 소유 인증은 하지 않습니다. 가입하면 1개월 체험이 시작되며 최고관리자에게 정식 이용 승인을 신청할 수 있습니다. 자동 가입 방지를 위한 보안 확인은 필요합니다.</p>
            <button type="submit" disabled={!canSubmit} className="w-full rounded-xl bg-orange-600 p-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? '가입 처리 중…' : !enabled ? '가입 설정 준비 중' : '가입하고 시작하기'}
            </button>
        </form>

        <div className="mt-6 border-t border-slate-100 pt-5 text-center">
          <p className="text-sm font-medium text-slate-500">이미 계정이 있으신가요? <Link to="/login" className="font-bold text-orange-600 hover:text-orange-700">로그인</Link></p>
        </div>
      </motion.section>
    </main>
  );
}

