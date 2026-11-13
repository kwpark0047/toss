import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
const api = vi.hoisted(() => ({ prepare: vi.fn(), getBrandPayConfig: vi.fn(), getTestConfig: vi.fn() }));
vi.mock('../api', () => ({ paymentsAPI: api }));
import { useTossPayment } from '../hooks/useTossPayment';
describe('Toss ready response contract', () => {
  it('uses a full-page checkout on narrow screens and preserves the return session', async () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    const requestPayment = vi.fn(async () => {});
    window.TossPayments = vi.fn(() => ({ requestPayment }));
    api.prepare.mockResolvedValue({ payment_id: 9, order_number: 'mobile-order' });
    try {
      const { result } = renderHook(() => useTossPayment());
      await act(async () => { await result.current.initiateTossPayment({ orderId: 4, storeId: 1, totalAmount: 1000, capability: 'fixture-capability' }); });
      expect(requestPayment).toHaveBeenCalledWith('카드', expect.objectContaining({ windowTarget: 'self', amount: 1000, orderId: 'mobile-order' }));
      expect(JSON.parse(sessionStorage.getItem('wm_pending_payment:9')).capability).toBe('fixture-capability');
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
    }
  });
  it('blocks test checkout before payment preparation when test keys are unavailable', async () => {
    api.prepare.mockClear();
    api.getTestConfig.mockResolvedValue({ data: { enabled: false } });
    const { result } = renderHook(() => useTossPayment());
    let response;
    await act(async () => { response = await result.current.initiateTossPayment({ orderId: 4, storeId: 1, totalAmount: 1000, testOnly: true }); });
    expect(response.success).toBe(false);
    expect(api.prepare).not.toHaveBeenCalled();
  });
  it('uses only the server-confirmed test key for test checkout', async () => {
    api.getTestConfig.mockResolvedValue({ data: { enabled: true, clientKey: 'test_ck_server_only' } });
    api.prepare.mockResolvedValue({ payment_id: 9, order_number: 'fixture-test-order' });
    const { result } = renderHook(() => useTossPayment());
    await act(async () => { await result.current.initiateTossPayment({ orderId: 4, storeId: 1, totalAmount: 1000, testOnly: true }); });
    expect(window.TossPayments).toHaveBeenCalledWith('test_ck_server_only');
  });
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
