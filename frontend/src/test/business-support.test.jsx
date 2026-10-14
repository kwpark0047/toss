import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {test,expect,vi,beforeEach} from 'vitest';
const api=vi.hoisted(()=>({list:vi.fn(),overview:vi.fn(),enrollment:vi.fn(),enroll:vi.fn(),detail:vi.fn(),transition:vi.fn(),rescan:vi.fn(),evaluate:vi.fn()}));
vi.mock('../api/businessSupport',()=>({businessSupportAPI:api}));
import BusinessSupportCenter from '../components/admin/BusinessSupportCenter';
beforeEach(()=>{vi.clearAllMocks();api.list.mockResolvedValue({data:{items:[],next_cursor:null}});api.overview.mockResolvedValue({data:{enrolled_stores:2,cases:[],jobs:[]}});api.enrollment.mockResolvedValue({data:{enabled:true,can_consent:true}});});
const mount=(url='/admin/business-support')=>render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/admin/business-support" element={<BusinessSupportCenter/>}/><Route path="/admin/stores/:storeId/support" element={<BusinessSupportCenter/>}/></Routes></MemoryRouter>);
test('platform has no owner approval action and shows enrolled scope',async()=>{
  mount();expect(await screen.findByText('지원 대상 2개 매장')).toBeVisible();
  expect(screen.queryByRole('button',{name:'승인'})).not.toBeInTheDocument();
  expect(screen.getByText('아직 지원 제안이 없습니다.')).toBeVisible();
});
test('failure is visible and retry restores the list',async()=>{
  api.list.mockRejectedValueOnce(Error('offline'));mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('불러오지 못했습니다');
  fireEvent.click(screen.getByRole('button',{name:'다시 조회'}));
  expect(await screen.findByText('아직 지원 제안이 없습니다.')).toBeVisible();
});
test('owner must explicitly consent and missing data is not a successful analysis',async()=>{
  api.enrollment.mockResolvedValue({data:{enabled:false,can_consent:true}});
  api.enroll.mockResolvedValue({data:{enabled:true}});mount('/admin/stores/3/support');
  const consent=await screen.findByRole('checkbox',{name:/매장 데이터 분석/});
  expect(consent).not.toBeChecked();fireEvent.click(consent);
  fireEvent.click(screen.getByRole('button',{name:'동의 설정 저장'}));
  await waitFor(()=>expect(api.enroll).toHaveBeenCalledWith('3',true));
});
test('read-only support case has an acknowledgement instead of QR execution',async()=>{
 const row={id:'case',store_id:3,store_name:'테스트 매장',status:'sent',priority:1,snapshot_id:'snapshot',action_id:null,evidence:{quality:'insufficient',as_of:new Date().toISOString(),facts:{pending_orders:2},insights:[{title:'접수 대기',detail:'영업 확인 필요'}]},events:[]};
 api.list.mockResolvedValue({data:{items:[row]}});api.detail.mockResolvedValue({data:row});mount('/admin/stores/3/support');
 fireEvent.click(await screen.findByRole('button',{name:'근거·지원안'}));
 expect(await screen.findByRole('button',{name:'확인·조치 완료'})).toBeVisible();
 expect(screen.queryByRole('button',{name:'QR 노출 시작'})).not.toBeInTheDocument();
 expect(screen.getByText('자료 부족')).toBeVisible();
});
test('approved QR action waits for explicit in-app confirmation',async()=>{
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 const row={id:'case',store_id:3,store_name:'테스트 매장',status:'approved',priority:1,snapshot_id:'snapshot',action_id:'action',evidence:{quality:'observed',facts:{},insights:[]},events:[]};
 api.list.mockResolvedValue({data:{items:[row]}});api.detail.mockResolvedValue({data:row});api.transition.mockResolvedValue({data:{status:'running'}});
 mount('/admin/stores/3/support');fireEvent.click(await screen.findByRole('button',{name:'근거·지원안'}));
 fireEvent.click(await screen.findByRole('button',{name:'QR 노출 시작',exact:true}));
 expect(api.transition).not.toHaveBeenCalled();
 expect(await screen.findByRole('dialog',{name:'QR 추천 노출을 시작할까요?'})).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'7일 QR 노출 시작'}));
 await waitFor(()=>expect(api.transition).toHaveBeenCalledWith(3,'case','execute',expect.any(String),''));
});
