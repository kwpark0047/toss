import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const api = vi.hoisted(() => ({
  getInventory: vi.fn(),
  getPurchases: vi.fn(),
  createPurchaseDraft: vi.fn(),
  markPurchaseOrdered: vi.fn(),
  receivePurchase: vi.fn(),
}));

vi.mock('@/api', () => ({ inventoryAPI: api }));
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import PurchasePanel from '@/components/admin/PurchasePanel';

describe('PurchasePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getInventory.mockResolvedValue({ data: { products: [{ id: 5, name: '원두' }] } });
    api.getPurchases.mockResolvedValue({ data: { purchases: [] } });
    api.createPurchaseDraft.mockResolvedValue({ data: { id: 10 } });
    api.receivePurchase.mockResolvedValue({ data: { id: 12 } });
  });

  it('creates a store purchase draft from selected item, quantity, and unit cost', async () => {
    render(<PurchasePanel storeId="3" onBack={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('공급처 이름'), { target: { value: '원두상회' } });
    fireEvent.change(screen.getAllByLabelText('상품')[0], { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('수량'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('개당 매입가(원)'), { target: { value: '12000' } });
    fireEvent.click(screen.getByRole('button', { name: '발주 초안 저장' }));

    await waitFor(() => expect(api.createPurchaseDraft).toHaveBeenCalledWith('3', {
      supplier_name: '원두상회',
      items: [{ product_id: 5, ordered_quantity: 4, unit_cost: 12000, unit: '개' }],
    }));
  });

  it('receives only the remaining ordered quantity and sends an idempotency key', async () => {
    api.getPurchases.mockResolvedValue({ data: { purchases: [{
      id: 44,
      order_number: 'PO-3-44',
      status: 'ORDERED',
      total_amount: 2000,
      created_at: '2026-10-30T00:00:00.000Z',
      items: [{ id: 9, product_name: '원두', ordered_quantity: 5, received_quantity: 2, unit_cost: 1000, unit: '개' }],
    }] } });
    render(<PurchasePanel storeId="3" onBack={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: '입고 반영' }));
    await waitFor(() => expect(api.receivePurchase).toHaveBeenCalledWith(
      '3',
      44,
      { items: [{ purchase_order_item_id: 9, quantity_received: 3, unit_cost: 1000 }] },
      expect.any(String),
    ));
  });
});
