import {useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useAuth} from '../contexts/AuthContext';
import {freeAuthAPI} from '../api/freeAuth';
import FreeAuthOptions from '../components/FreeAuthOptions';
export default function AccountSecurityPage(){
 const auth=useAuth(),navigate=useNavigate();
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[password,setPassword]=useState(''),[totp,setTotp]=useState('');
 const [proof,setProof]=useState(()=>auth.getRecentAuthProof?.()||null),[confirm,setConfirm]=useState(false);
 const [operation]=useState(()=>crypto.randomUUID());
 async function reload(){try{setData(await freeAuthAPI.accounts());}catch(e){setError(e.response?.data?.message||'인증 설정을 불러오지 못했습니다.');}}
 useEffect(()=>{void reload();},[]);
 useEffect(()=>{if(!proof)return;const timer=setTimeout(()=>{setProof(null);auth.clearRecentAuthProof?.();},300000);return()=>clearTimeout(timer);},[proof]);
 async function run(work){setBusy(true);setError('');try{await work();}catch(e){if(e.response?.status===403){setProof(null);auth.clearRecentAuthProof?.();}setError(e.response?.data?.message||e.message);}finally{setBusy(false);}}
 function result(value){if(value.reauthProof)setProof(value.reauthProof);if(value.linked){setProof(null);auth.clearRecentAuthProof?.();void reload();}}
 return <div className="max-w-xl mx-auto space-y-5 p-4 text-slate-100"><h1 className="text-2xl font-bold">계정 인증·보안</h1>
  <p className="text-sm text-slate-400">기존 비밀번호·연결된 계정을 보존합니다. 인증 수단 변경과 탈퇴에는 최근 재인증이 필요합니다.</p>
  {error&&<p role="alert" className="rounded-xl border border-red-500 p-3">{error}</p>}
  <section className="rounded-xl border border-white/10 p-4"><h2 className="font-bold mb-3">연결된 인증 수단</h2>
   {!data?<p>설정 확인 중…</p>:<ul className="space-y-2">{data.password_login_enabled&&<li>기존 비밀번호</li>}{data.identities.map((item,index)=><li className="flex justify-between gap-3" key={`${item.provider}-${index}`}><span>{item.provider}{item.email?` · ${item.email}`:''}</span><button className="underline disabled:opacity-50" disabled={busy||!proof} onClick={()=>run(async()=>{await freeAuthAPI.unlink(item.provider,proof);setProof(null);auth.clearRecentAuthProof?.();await reload();})}>연결 해제</button></li>)}</ul>}
  </section>
  <section className="rounded-xl border border-white/10 p-4 space-y-3"><h2 className="font-bold">최근 본인 인증</h2>
   {proof?<p role="status">재인증 완료. 5분 안에 인증 수단을 연결하거나 변경해 주세요.</p>:<>
    <form className="space-y-2" onSubmit={e=>{e.preventDefault();void run(async()=>result(await freeAuthAPI.reauth('password',password)));}}><label className="block text-sm">현재 비밀번호<input aria-label="현재 비밀번호" type="password" autoComplete="current-password" className="w-full rounded-lg border p-2 text-slate-900" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="rounded-lg border p-2" disabled={busy||!password}>비밀번호로 재인증</button></form>
    <form className="space-y-2" onSubmit={e=>{e.preventDefault();void run(async()=>result(await freeAuthAPI.reauth('totp',totp)));}}><label className="block text-sm">인증 앱 코드<input aria-label="인증 앱 코드" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="w-full rounded-lg border p-2 text-slate-900" value={totp} onChange={e=>setTotp(e.target.value.replace(/\D/g,''))}/></label><button className="rounded-lg border p-2" disabled={busy||totp.length!==6}>인증 앱으로 재인증</button></form>
   </>}
  </section>
  <section className="rounded-xl bg-white p-4"><FreeAuthOptions mode={proof?'link':'reauth'} reauthProof={proof} onResult={result}/></section>
  <section className="rounded-xl border border-red-500/40 p-4 space-y-3"><h2 className="font-bold">회원 탈퇴</h2><p className="text-sm text-slate-400">모든 로그인 세션을 종료하고 프로필을 비식별화합니다. 소유 매장·구독은 먼저 정리해야 하며 주문·정산 기록과 공급자 로그인 동의는 자동 삭제하지 않습니다.</p>
   <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/>위 내용을 확인하고 계정 탈퇴를 요청합니다.</label>
   <button className="rounded-lg border border-red-400 p-3 text-red-300 disabled:opacity-50" disabled={busy||!proof||!confirm} onClick={()=>run(async()=>{await freeAuthAPI.withdraw(proof,operation);await auth.clearAuthentication();navigate('/auth',{replace:true});})}>회원 탈퇴 요청</button>
  </section>
 </div>;
}
