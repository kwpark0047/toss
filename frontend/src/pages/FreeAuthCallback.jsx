import {useEffect,useRef,useState} from 'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import {useAuth} from '../contexts/AuthContext';
import {freeAuthAPI,getBrowserProof} from '../api/freeAuth';
import FreeAuthOptions from '../components/FreeAuthOptions';
export default function FreeAuthCallback(){
 const location=useLocation(),navigate=useNavigate(),auth=useAuth();
 const params=useRef(new URLSearchParams(location.hash.slice(1))).current,started=useRef(null);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[mfa,setMfa]=useState(null);
 const email=location.pathname.endsWith('/email');
 async function finish(data){
  if(data.twoFactorRequired){setMfa(data);return;}
  if(data.reauthProof||data.linked){if(data.reauthProof)auth.saveRecentAuthProof(data.reauthProof);navigate('/admin/account-security',{replace:true});return;}
  await auth.acceptAuthentication(data);navigate('/admin',{replace:true});
 }
 useEffect(()=>{
  window.history.replaceState({},'',window.location.pathname);
  if(email)return;
  if(params.get('error')){setError('소셜 로그인이 취소됐거나 만료됐습니다. 다시 시작해 주세요.');return;}
  let live=true;
  if(!started.current){started.current=getBrowserProof(false)?freeAuthAPI.exchange(params.get('flow')):Promise.reject(new Error('인증을 시작한 브라우저에서 다시 진행해 주세요.'));}
  setBusy(true);started.current.then(data=>{if(live)void finish(data).catch(e=>setError(e.message));}).catch(e=>{if(live)setError(e.response?.data?.message||e.message);}).finally(()=>{if(live)setBusy(false);});
  return()=>{live=false;};
  // A single exchange is shared across StrictMode effects; never replay POST.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 async function confirm(){setBusy(true);setError('');try{await finish(await freeAuthAPI.verifyEmail({id:params.get('challenge'),token:params.get('token')}));}catch(e){setError(e.response?.data?.message||e.message);}finally{setBusy(false);}}
 return <main className="min-h-screen bg-slate-50 px-4 py-12"><div className="mx-auto max-w-md rounded-2xl border bg-white p-6 text-slate-900 space-y-4">
  <h1 className="text-2xl font-bold">위마켓 인증 확인</h1>
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  {busy&&<p role="status">인증 결과를 확인 중입니다…</p>}
  {email&&!mfa&&<><p className="text-sm">직접 요청한 이메일이 맞다면 아래 버튼을 눌러 주세요. 다른 기기에서는 가입을 시작한 화면에 6자리 인증번호를 입력해 주세요.</p><button className="w-full rounded-xl bg-orange-600 p-3 font-bold text-white disabled:opacity-50" disabled={busy} onClick={confirm}>이메일 인증 확인</button></>}
  {mfa&&<FreeAuthOptions initialResult={mfa} onResult={data=>{if(data.reauthProof){auth.saveRecentAuthProof(data.reauthProof);navigate('/admin/account-security',{replace:true});}}}/>}
  <Link className="text-sm underline" to="/auth">로그인으로 돌아가기</Link>
 </div></main>;
}
