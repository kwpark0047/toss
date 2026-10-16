import {useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useAuth} from '../contexts/AuthContext';
import {freeAuthAPI} from '../api/freeAuth';
import TurnstileChallenge from './TurnstileChallenge';
export default function FreeAuthOptions({mode='login',reauthProof=null,onResult,onAvailability,initialResult=null}){
 const navigate=useNavigate(),{acceptAuthentication}=useAuth();
 const [config,setConfig]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [token,setToken]=useState(null),[generation,setGeneration]=useState(0),[terms,setTerms]=useState(false),[privacy,setPrivacy]=useState(false);
 const [email,setEmail]=useState(''),[challenge,setChallenge]=useState(null),[code,setCode]=useState(''),[wait,setWait]=useState(0),[mfa,setMfa]=useState(null);
 useEffect(()=>{if(initialResult?.twoFactorRequired)setMfa(initialResult.tempToken);},[initialResult]);
 useEffect(()=>{let live=true;freeAuthAPI.config().then(data=>{if(live){setConfig(data);onAvailability?.({google:!!(data.enabled&&data.google),kakao:!!(data.enabled&&data.kakao)});}}).catch(()=>{if(live)setConfig({enabled:false});});return()=>{live=false;};},[onAvailability]);
 useEffect(()=>{if(wait<=0)return;const id=setTimeout(()=>setWait(n=>n-1),1000);return()=>clearTimeout(id);},[wait]);
 const allowed=mode!=='signup'||(terms&&privacy&&config?.termsUrl&&config?.privacyUrl);
 async function finish(data){
  if(data.twoFactorRequired){setMfa(data.tempToken);setCode('');return;}
  if(data.linked||data.reauthProof){setChallenge(null);setCode('');setWait(0);setError('');onResult?.(data);return;}
  await acceptAuthentication(data);navigate('/admin',{replace:true});
 }
 async function run(work){setBusy(true);setError('');try{await work();}catch(e){setError(e.response?.data?.message||e.message||'인증을 완료하지 못했습니다.');}finally{setBusy(false);}}
 async function start(provider){await run(async()=>{
  const data=await freeAuthAPI.startOAuth({provider,intent:mode,turnstileToken:token,reauthProof,agreeTerms:terms,agreePrivacy:privacy});
  const target=new URL(data.url);if(!['https://accounts.google.com','https://kauth.kakao.com'].includes(target.origin))throw new Error('인증 주소를 확인할 수 없습니다.');window.location.assign(target.href);
 });setToken(null);setGeneration(n=>n+1);}
 async function request(event){event.preventDefault();await run(async()=>{const data=await freeAuthAPI.requestEmail({email,purpose:mode,turnstileToken:token,reauthProof,agreeTerms:terms,agreePrivacy:privacy});setChallenge(data.challengeId);setWait(60);setCode('');});setToken(null);setGeneration(n=>n+1);}
 if(!config)return <p role="status" className="text-sm text-slate-500 py-3">인증 방법 확인 중…</p>;
 if(!config.enabled&&!mfa)return <p className="text-sm text-slate-500 py-3">무료 인증은 설정을 준비 중입니다. 기존 로그인·가입 방식을 이용할 수 있습니다.</p>;
 return <section aria-label="무료 인증" className="space-y-4 mb-6 text-slate-900">
  <h2 className="font-bold">{mode==='signup'?'문자 없이 회원가입':mode==='link'?'인증 수단 연결':mode==='reauth'?'최근 본인 인증':'간편 로그인'}</h2>
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  {mode==='signup'&&<div className="space-y-2 text-sm">
   <label className="flex gap-2"><input type="checkbox" checked={terms} onChange={e=>setTerms(e.target.checked)} aria-label="이용약관에 동의합니다"/>이용약관에 동의합니다 {config.termsUrl&&<a className="underline" href={config.termsUrl} target="_blank" rel="noreferrer">보기</a>}</label>
   <label className="flex gap-2"><input type="checkbox" checked={privacy} onChange={e=>setPrivacy(e.target.checked)} aria-label="개인정보 처리방침에 동의합니다"/>개인정보 처리방침에 동의합니다 {config.privacyUrl&&<a className="underline" href={config.privacyUrl} target="_blank" rel="noreferrer">보기</a>}</label>
   {(!config.termsUrl||!config.privacyUrl)&&<p>약관 등록 후 신규 가입을 이용할 수 있습니다.</p>}
  </div>}
  {!mfa&&<>
   <TurnstileChallenge siteKey={config.turnstileSiteKey} action={mode} onToken={setToken} generation={generation}/>
   <div className="space-y-2">
    {config.google&&mode!=='reauth'&&<button type="button" className="w-full rounded-xl border border-slate-300 bg-white p-3 font-semibold disabled:opacity-50" disabled={busy||!token||!allowed} onClick={()=>start('google')}>Google로 계속하기</button>}
    {config.google&&mode==='reauth'&&<p className="text-sm text-slate-600">Google 재인증은 최근 인증 시점을 확인할 수 없어 지원하지 않습니다. 이메일·기존 비밀번호·인증 앱으로 재인증해 주세요.</p>}
    {config.kakao&&<button type="button" className="w-full rounded-xl bg-yellow-300 p-3 font-semibold disabled:opacity-50" disabled={busy||!token||!allowed} onClick={()=>start('kakao')}>카카오로 계속하기</button>}
   </div>
   {config.email&&<form onSubmit={request} className="space-y-3">
    <label className="block text-sm">이메일<input aria-label="이메일" type="email" autoComplete="email" required value={email} disabled={busy||!!challenge} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900"/></label>
    <button className="w-full rounded-xl bg-orange-600 p-3 font-semibold text-white disabled:opacity-50" disabled={busy||!token||!allowed||wait>0}>{wait>0?`${wait}초 후 재발송`:challenge?'이메일 다시 받기':'이메일 인증 받기'}</button>
   </form>}
   {challenge&&<form className="space-y-3" onSubmit={e=>{e.preventDefault();void run(async()=>finish(await freeAuthAPI.verifyEmail({id:challenge,code})));}}>
    <p role="status" className="text-sm">메일함의 링크를 열거나 5분 안에 6자리 인증번호를 입력해 주세요.</p>
    <label className="block text-sm">6자리 이메일 인증번호<input aria-label="6자리 이메일 인증번호" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} className="mt-1 w-full rounded-xl border p-3"/></label>
    <button className="w-full rounded-xl bg-slate-900 p-3 text-white disabled:opacity-50" disabled={busy||code.length!==6}>인증하고 계속하기</button>
    <button type="button" className="text-sm underline" disabled={busy} onClick={()=>{setChallenge(null);setCode('');}}>다른 이메일 사용</button>
   </form>}
  </>}
  {mfa&&<form className="space-y-3" onSubmit={e=>{e.preventDefault();void run(async()=>finish(await freeAuthAPI.mfa({tempToken:mfa,code})));}}>
   <label className="block text-sm">인증 앱 코드 또는 복구 코드<input aria-label="인증 앱 코드 또는 복구 코드" autoComplete="one-time-code" value={code} maxLength={100} onChange={e=>setCode(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label>
   <button className="rounded-xl bg-slate-900 p-3 text-white" disabled={busy||!code}>2단계 인증 완료</button>
   <p className="text-sm">기존 SMS 2FA만 설정했다면 기존 비밀번호 로그인으로 진행해 주세요.</p>
  </form>}
  {busy&&<p role="status" className="text-sm">서버 연결과 인증을 확인 중입니다…</p>}
  {!config.google&&!config.kakao&&!config.email&&<p>인증 공급자 설정이 필요합니다. 기존 로그인은 계속 사용할 수 있습니다.</p>}
 </section>;
}
