import {useEffect,useRef,useState} from 'react';
let scriptPromise;
function load(){
 if(window.turnstile)return Promise.resolve(window.turnstile);
 if(!scriptPromise)scriptPromise=new Promise((resolve,reject)=>{
  let script=document.querySelector('script[data-wemarket-turnstile]');
  const fresh=!script;if(fresh){script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.defer=true;script.dataset.wemarketTurnstile='true';}
  const timer=setTimeout(()=>reject(new Error('보안 확인을 불러오지 못했습니다.')),10000);
  script.addEventListener('load',()=>{clearTimeout(timer);window.turnstile?resolve(window.turnstile):reject(new Error('보안 확인을 불러오지 못했습니다.'));},{once:true});
  script.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('보안 확인을 불러오지 못했습니다.'));},{once:true});
  if(fresh)document.head.appendChild(script);
 }).catch(error=>{document.querySelector('script[data-wemarket-turnstile]')?.remove();scriptPromise=null;throw error;});
 return scriptPromise;
}
export default function TurnstileChallenge({siteKey,action,onToken,generation=0}){
 const container=useRef(null),callback=useRef(onToken);const [error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{callback.current=onToken;},[onToken]);
 useEffect(()=>{
  let disposed=false,id;setError('');callback.current(null);
  load().then(widget=>{if(disposed||!container.current)return;id=widget.render(container.current,{sitekey:siteKey,action,callback:token=>callback.current(token),'expired-callback':()=>callback.current(null),'error-callback':()=>{callback.current(null);setError('보안 확인을 다시 진행해 주세요.');}});}).catch(e=>{if(!disposed)setError(e.message);});
  return()=>{disposed=true;if(id!==undefined)window.turnstile?.remove(id);};
 },[siteKey,action,generation,retry]);
 return <div><div ref={container} aria-label="자동 가입 방지"/>{error&&<><p role="alert" className="text-sm text-red-600">{error}</p><button type="button" onClick={()=>setRetry(n=>n+1)}>보안 확인 다시 불러오기</button></>}</div>;
}
