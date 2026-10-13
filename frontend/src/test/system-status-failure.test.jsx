import {render,screen,waitFor} from '@testing-library/react';
import {test,expect,vi} from 'vitest';
vi.mock('../lib/useSEO',()=>({useSEO:()=>{}}));
vi.mock('../api',()=>({default:{get:vi.fn(path=>path==='/health/deep'?Promise.resolve({status:'ok',checks:{}}):Promise.reject({response:{data:{error:'denied'}}}))}}));
import SystemStatus from '../components/admin/SystemStatus';
test('failed section remains explicitly visible alongside healthy overall status',async()=>{
 render(<SystemStatus/>);
 await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('/health/sla'));
});
