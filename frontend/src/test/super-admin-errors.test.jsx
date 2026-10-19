import {render,screen,waitFor} from '@testing-library/react';
import {test,expect,vi} from 'vitest';
vi.mock('react-router-dom',()=>({useNavigate:()=>vi.fn()}));
vi.mock('../lib/useSEO',()=>({useSEO:()=>{}}));
vi.mock('../api/admin',()=>({adminAPI:{platformOverview:()=>Promise.reject(Error('offline')),platformTrend:()=>Promise.resolve({daily:[]}),enrichmentCoverage:()=>Promise.resolve({}),linkRequests:()=>Promise.resolve({requests:[]}),businessTrials:()=>Promise.resolve({accounts:[]}),platformStores:()=>Promise.resolve({stores:[]})},plansAPI:{getStats:()=>Promise.resolve({})}}));
import SuperAdminDashboard from '../components/admin/SuperAdminDashboard';
test('overview failure is visible instead of indefinite silent skeleton',async()=>{
 render(<SuperAdminDashboard/>);
 await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('전체 지표'));
});

