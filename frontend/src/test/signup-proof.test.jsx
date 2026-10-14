import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {test,expect,vi,beforeEach} from 'vitest';
const api=vi.hoisted(()=>({sendOtp:vi.fn(),verifyOtp:vi.fn(),register:vi.fn()}));
vi.mock('../api/auth',()=>({authAPI:api}));
vi.mock('../api/client',()=>({API_URL:'http://local.invalid/api',default:{get:vi.fn()}}));
vi.mock('../lib/sentry',()=>({syncSentryUser:vi.fn()}));
import {AuthProvider,useAuth} from '../contexts/AuthContext';
function Flow(){const auth=useAuth();return <><button onClick={()=>auth.verifyOtp('010-1234-5678','123456')}>verify</button><button onClick={()=>auth.register({phone:'01012345678',password:'Password123'})}>register</button><button onClick={()=>auth.register({phone:'01087654321',password:'Password123'}).catch(()=>{})}>other phone</button></>;}
beforeEach(()=>{localStorage.clear();vi.clearAllMocks();api.verifyOtp.mockResolvedValue({data:{verified:true,verificationToken:'fixture-proof'}});api.register.mockResolvedValue({data:{token:'fixture-access',user:{id:11,role:'user'}}});});
test('signup carries verified proof in memory to registration and blocks phone substitution',async()=>{
 render(<AuthProvider><Flow/></AuthProvider>);
 fireEvent.click(screen.getByRole('button',{name:'verify',exact:true}));await waitFor(()=>expect(api.verifyOtp).toHaveBeenCalled());
 fireEvent.click(screen.getByRole('button',{name:'other phone'}));expect(api.register).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'register',exact:true}));
 await waitFor(()=>expect(api.register).toHaveBeenCalledWith({phone:'01012345678',password:'Password123',verificationToken:'fixture-proof'}));
 expect(localStorage.getItem('verificationToken')).toBeNull();
});
