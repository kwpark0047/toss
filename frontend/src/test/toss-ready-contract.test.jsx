import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
const api = vi.hoisted(() => ({ prepare: vi.fn(), getBrandPayConfig: vi.fn() }));
vi.mock('../api', () => ({ paymentsAPI: api }));
import { useTossPayment } from '../hooks/useTossPayment';
describe('Toss ready response contract', () => {
  beforeEach(() => { sessionStorage.clear(); api.getBrandPayConfig.mockResolvedValue({data:{clientKey:'test_ck_fixture'}}); window.TossPayments = vi.fn(() => ({requestPayment:vi.fn(async()=>{})})); });
  for (const wrapped of [false,true]) it(`accepts ${wrapped?'wrapped':'actual flat'} ready response`, async()=>{
    const ready={success:true,payment_id:9,order_number:'fixture-order-123'};
    api.prepare.mockResolvedValue(wrapped?{data:ready}:ready);
    const {result}=renderHook(()=>useTossPayment());
    let response;
    await act(async()=>{response=await result.current.initiateTossPayment({orderId:4,storeId:1,totalAmount:7500,capability:'fixture-capability'});});
    expect(response).toEqual({success:true,pendingRedirect:true});
    expect(JSON.parse(sessionStorage.getItem('wm_pending_payment:9')).providerOrderId).toBe(ready.order_number);
  });
});
