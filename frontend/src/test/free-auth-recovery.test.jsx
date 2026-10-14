import React from 'react';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import TurnstileChallenge from '../components/TurnstileChallenge';
afterEach(()=>{cleanup();document.querySelector('script[data-wemarket-turnstile]')?.remove();delete window.turnstile;});
it('removes a failed Turnstile script and reloads on explicit retry',async()=>{
 render(<TurnstileChallenge siteKey="fixture" action="login" onToken={()=>{}}/>);
 const first=document.querySelector('script[data-wemarket-turnstile]');fireEvent.error(first);
 await screen.findByRole('alert');expect(first.isConnected).toBe(false);
 fireEvent.click(screen.getByRole('button',{name:'보안 확인 다시 불러오기'}));
 await waitFor(()=>expect(document.querySelector('script[data-wemarket-turnstile]')).not.toBeNull());
 const second=document.querySelector('script[data-wemarket-turnstile]');expect(second).not.toBe(first);
 window.turnstile={render:vi.fn(()=> 'widget'),remove:vi.fn()};fireEvent.load(second);
 await waitFor(()=>expect(window.turnstile.render).toHaveBeenCalled());
});
