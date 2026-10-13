import {render,waitFor,screen,fireEvent} from '@testing-library/react';
import {test,expect,vi} from 'vitest';
const {get,post,navigate,t,socket}=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),navigate:vi.fn(),t:key=>key,socket:{connected:false,on:vi.fn(),off:vi.fn()}}));
vi.mock('react-router-dom',()=>({useParams:()=>({storeId:'1'}),useNavigate:()=>navigate,Link:({to,children,...rest})=><a href={to} {...rest}>{children}</a>}));
vi.mock('../api/client',()=>({default:{get,post}}));
vi.mock('react-i18next',()=>({useTranslation:()=>({t})}));
vi.mock('../utils/socket',()=>({connectKitchen:vi.fn(),getSocket:()=>socket}));
vi.mock('../utils/notificationSound',()=>({default:{playNewOrder:vi.fn(),playSuccess:vi.fn(),playOrderReady:vi.fn()},vibrateShort:vi.fn(),vibrateOrderReady:vi.fn()}));
vi.mock('../hooks/usePrinter',()=>({usePrinter:()=>({isSupported:false,connectPrinter:vi.fn(),printReceipt:vi.fn()})}));
const fixtureUser={id:1,role:'staff'};
vi.mock('../contexts/AuthContext',()=>({useAuth:()=>({user:fixtureUser})}));
vi.mock('../api',()=>({storesAPI:{getMy:()=>Promise.resolve({data:[{id:1,role:'manager'}]}),getById:()=>Promise.resolve({id:1,name:'fixture'})},ordersAPI:{getByStore:()=>Promise.resolve({data:[]}),getStats:()=>Promise.resolve({data:{}})}}));
import KitchenDisplay from '../pages/KitchenDisplay';
import ManagerView from '../pages/ManagerView';
test('kitchen uses authenticated API client and displays failed loading',async()=>{
 get.mockRejectedValue(Error('fixture unavailable'));render(<KitchenDisplay/>);
 await waitFor(()=>expect(get).toHaveBeenCalledWith('/kds/stores/1/orders'));
 expect(await screen.findByRole('alert')).toBeTruthy();
});
test('manager assignment is based on store membership rather than global staff label',async()=>{
 render(<ManagerView/>);
 await screen.findByText('매니저 대시보드');
 expect(screen.queryByRole('alert')).not.toBeInTheDocument();
 expect(navigate).not.toHaveBeenCalledWith('/');
 expect(screen.getByRole('link',{name:'근무표'})).toHaveAttribute('href','/admin/stores/1/staff-scheduler');
 expect(screen.getByRole('link',{name:'매출 통계'})).toHaveAttribute('href','/admin/stores/1/sales');
});
test('missing printer shows inline feedback without status mutation or blocking dialog',async()=>{
 get.mockResolvedValue({data:[{id:7,order_number:'fixture-7',status:'preparing',items:[],created_at:new Date().toISOString()}]});
 post.mockClear();const alert=vi.spyOn(window,'alert').mockImplementation(()=>{});
 render(<KitchenDisplay/>);
 fireEvent.click(await screen.findByTitle('주방 인쇄 작업 강제 추가'));
 await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('프린터'));
 expect(post).not.toHaveBeenCalled();expect(alert).not.toHaveBeenCalled();alert.mockRestore();
});
