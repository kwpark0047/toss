import React from 'react';
import {render,screen,fireEvent,waitFor,cleanup,act} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({accounts:vi.fn(),unlink:vi.fn(),clear:vi.fn()}));
vi.mock('../api/freeAuth',()=>({freeAuthAPI:mocks}));
vi.mock('../contexts/AuthContext',()=>({useAuth:()=>({getRecentAuthProof:()=> 'recent-proof',clearRecentAuthProof:mocks.clear})}));
vi.mock('../components/FreeAuthOptions',()=>({default:({mode})=><span data-testid="auth-mode">{mode}</span>}));
import AccountSecurityPage from '../pages/AccountSecurityPage';
beforeEach(()=>{vi.clearAllMocks();mocks.accounts.mockResolvedValue({identities:[{provider:'google'}],password_login_enabled:true});});
afterEach(()=>{cleanup();vi.useRealTimers();});
it('offers reauthentication again after the server rejects an expired proof',async()=>{
 mocks.unlink.mockRejectedValue({response:{status:403,data:{message:'재인증 필요'}}});
 render(<MemoryRouter><AccountSecurityPage/></MemoryRouter>);
 fireEvent.click(await screen.findByRole('button',{name:'연결 해제'}));
 await screen.findByLabelText('현재 비밀번호');expect(mocks.clear).toHaveBeenCalled();expect(screen.getByTestId('auth-mode')).toHaveTextContent('reauth');
});
it('expires a retained proof locally instead of trapping the user in authenticated state',async()=>{
 render(<MemoryRouter><AccountSecurityPage/></MemoryRouter>);
 await waitFor(()=>expect(screen.getByRole('status')).toBeInTheDocument());
 vi.useFakeTimers();
 // Remount under fake timers so the five-minute expiry uses the controlled clock.
 cleanup();render(<MemoryRouter><AccountSecurityPage/></MemoryRouter>);
 await act(async()=>{await vi.advanceTimersByTimeAsync(300000);});
 expect(screen.getByLabelText('현재 비밀번호')).toBeInTheDocument();expect(mocks.clear).toHaveBeenCalled();
});
