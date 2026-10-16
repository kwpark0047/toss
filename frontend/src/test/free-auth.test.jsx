import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({config:vi.fn(),requestEmail:vi.fn(),verifyEmail:vi.fn(),startOAuth:vi.fn(),accept:vi.fn()}));
vi.mock('../api/freeAuth',()=>({freeAuthAPI:mock,getBrowserProof:()=> 'a'.repeat(43)}));
vi.mock('../contexts/AuthContext',()=>({useAuth:()=>({acceptAuthentication:mock.accept})}));
vi.mock('../components/TurnstileChallenge',()=>({default:({onToken})=><button onClick={()=>onToken('fixture-token')}>보안 확인</button>}));
import FreeAuthOptions from '../components/FreeAuthOptions';
beforeEach(()=>{vi.clearAllMocks();mock.config.mockResolvedValue({enabled:true,google:true,kakao:true,email:true,turnstileSiteKey:'site',termsUrl:'https://app.invalid/terms',privacyUrl:'https://app.invalid/privacy'});mock.requestEmail.mockResolvedValue({challengeId:'fixture',expiresIn:300});mock.verifyEmail.mockResolvedValue({token:'access',user:{id:1}});});
it('offers Google first and gates signup on both legal consent and a fresh challenge',async()=>{
 render(<MemoryRouter><FreeAuthOptions mode="signup"/></MemoryRouter>);
 const google=await screen.findByRole('button',{name:'Google로 계속하기'});expect(google).toBeDisabled();
 fireEvent.click(screen.getByLabelText('이용약관에 동의합니다'));fireEvent.click(screen.getByLabelText('개인정보 처리방침에 동의합니다'));fireEvent.click(screen.getByRole('button',{name:'보안 확인'}));expect(google).toBeEnabled();
 expect(screen.getAllByRole('button').findIndex(x=>x.textContent==='Google로 계속하기')).toBeLessThan(screen.getAllByRole('button').findIndex(x=>x.textContent==='카카오로 계속하기'));
});
it('sends one email challenge and requires explicit code verification before login',async()=>{
 render(<MemoryRouter><FreeAuthOptions mode="login"/></MemoryRouter>);
 await screen.findByRole('button',{name:'보안 확인'});fireEvent.click(screen.getByRole('button',{name:'보안 확인'}));
 fireEvent.change(screen.getByLabelText('이메일'),{target:{value:'a@example.com'}});fireEvent.click(screen.getByRole('button',{name:'이메일 인증 받기'}));
 await waitFor(()=>expect(mock.requestEmail).toHaveBeenCalledTimes(1));expect(mock.accept).not.toHaveBeenCalled();
 fireEvent.change(await screen.findByLabelText('6자리 이메일 인증번호'),{target:{value:'123456'}});fireEvent.click(screen.getByRole('button',{name:'인증하고 계속하기'}));
 await waitFor(()=>expect(mock.accept).toHaveBeenCalled());
});
it('unconfigured provider does not offer a fake login success',async()=>{
 mock.config.mockResolvedValue({enabled:false});render(<MemoryRouter><FreeAuthOptions mode="signup"/></MemoryRouter>);
 await screen.findByText(/무료 인증은 설정을 준비 중/);expect(screen.queryByRole('button',{name:'Google로 계속하기'})).toBeNull();
});
it('keeps legacy providers available when the feature flag has no configured OAuth provider',async()=>{
 const availability=vi.fn();mock.config.mockResolvedValue({enabled:true,google:false,kakao:false,email:false});
 render(<MemoryRouter><FreeAuthOptions onAvailability={availability}/></MemoryRouter>);
 await waitFor(()=>expect(availability).toHaveBeenCalledWith({google:false,kakao:false}));
});
it('completes a legacy MFA challenge even when new signup is disabled',async()=>{
 mock.config.mockResolvedValue({enabled:false});mock.mfa=vi.fn().mockResolvedValue({token:'access',refreshToken:'refresh',user:{id:1}});
 render(<MemoryRouter><FreeAuthOptions initialResult={{twoFactorRequired:true,tempToken:'temporary'}}/></MemoryRouter>);
 fireEvent.change(await screen.findByLabelText('인증 앱 코드 또는 복구 코드'),{target:{value:'123456'}});
 fireEvent.click(screen.getByRole('button',{name:'2단계 인증 완료'}));
 await waitFor(()=>expect(mock.accept).toHaveBeenCalled());
});
it('reports provider availability independently for mixed legacy configurations',async()=>{
 const availability=vi.fn();mock.config.mockResolvedValue({enabled:true,google:true,kakao:false,email:false});
 render(<MemoryRouter><FreeAuthOptions onAvailability={availability}/></MemoryRouter>);
 await waitFor(()=>expect(availability).toHaveBeenCalledWith({google:true,kakao:false}));
});

it('directs recent authentication to supported methods while retaining Google linking',async()=>{
 const {unmount}=render(<MemoryRouter><FreeAuthOptions mode="reauth"/></MemoryRouter>);
 await screen.findByRole('button',{name:'이메일 인증 받기'});
 expect(screen.queryByRole('button',{name:'Google로 계속하기'})).toBeNull();
 expect(screen.getByText(/Google.*재인증.*이메일/)).toBeInTheDocument();
 unmount();
 render(<MemoryRouter><FreeAuthOptions mode="link" reauthProof="proof"/></MemoryRouter>);
 expect(await screen.findByRole('button',{name:'Google로 계속하기'})).toBeInTheDocument();
});
it('removes a consumed email challenge after successful recent authentication',async()=>{
 const onResult=vi.fn();mock.verifyEmail.mockResolvedValue({reauthProof:'recent-proof'});
 render(<MemoryRouter><FreeAuthOptions mode="reauth" onResult={onResult}/></MemoryRouter>);
 fireEvent.click(await screen.findByRole('button',{name:'보안 확인'}));
 fireEvent.change(screen.getByLabelText('이메일'),{target:{value:'a@example.com'}});
 fireEvent.click(screen.getByRole('button',{name:'이메일 인증 받기'}));
 fireEvent.change(await screen.findByLabelText('6자리 이메일 인증번호'),{target:{value:'123456'}});
 fireEvent.click(screen.getByRole('button',{name:'인증하고 계속하기'}));
 await waitFor(()=>expect(onResult).toHaveBeenCalledWith({reauthProof:'recent-proof'}));
 expect(screen.queryByLabelText('6자리 이메일 인증번호')).toBeNull();
});

