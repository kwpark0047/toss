import { it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
vi.mock('../contexts/AuthContext',()=>({useAuth:()=>({user:{id:9,role:'super_admin'},loading:false})}));
vi.mock('../contexts/StoreContext',()=>({useStore:()=>{throw Error('BUSINESS_HOOK_MUST_NOT_RUN');}}));
vi.mock('../components/admin/SuperAdminDashboard',()=>({default:()=> <div>isolated platform dashboard</div>}));
import MasterDashboard from '../components/admin/MasterDashboard';
it('renders platform admin without mounting store dashboard hooks',()=>{
 render(<MasterDashboard />);
 expect(screen.getByText('isolated platform dashboard')).toBeTruthy();
});
