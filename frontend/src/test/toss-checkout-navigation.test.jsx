import {it,expect,vi,afterEach} from 'vitest';
import {renderHook,act} from '@testing-library/react';
const api=vi.hoisted(()=>({prepare:vi.fn(),getBrandPayConfig:vi.fn()}));
vi.mock('../api',()=>({paymentsAPI:api}));
import {useTossPayment} from '../hooks/useTossPayment';
afterEach(()=>{delete window.TossPayments;sessionStorage.clear();vi.clearAllMocks();});
it('opens official full-page checkout while retaining the same payment capability before navigation',async()=>{
 const requestPayment=vi.fn(async()=>{expect(JSON.parse(sessionStorage.getItem('wm_pending_payment:2522')).capability).toBe('fixture-proof');});
 window.TossPayments=()=>({requestPayment});
 api.getBrandPayConfig.mockResolvedValue({data:{clientKey:'test_ck_fixture'}});
 const {result}=renderHook(()=>useTossPayment());
 await act(()=>result.current.initiateTossPayment({orderId:2646,storeId:12,totalAmount:10000,capability:'fixture-proof',
  preparedPayment:{payment_id:2522,order_number:'20261017-0979-R-fixture',amount:10000}}));
 expect(api.prepare).not.toHaveBeenCalled();
 expect(requestPayment).toHaveBeenCalledWith('카드',expect.objectContaining({windowTarget:'self',orderId:'20261017-0979-R-fixture',amount:10000,
  successUrl:expect.stringContaining('/payment/success?payment_id=2522')}));
});

