import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ProductModal } from '../components/admin/ProductModal';
import { productsAPI } from '../api';
vi.mock('../api', () => ({
  productsAPI: { create: vi.fn(), update: vi.fn() },
  storesAPI: { getById: async () => ({ plan: 'free' }) },
  optionTemplatesAPI: { getByStore: async () => [] },
  aiAPI: {},
  uploadsAPI: {},
}));
vi.mock('../api/subscriptions', () => ({
  subscriptionsAPI: { get: async () => ({ data: { effective_plan: 'free' } }) },
}));
vi.mock('react-toastify', () => ({ toast: { warn: vi.fn(), error: vi.fn(), success: vi.fn() } }));
afterEach(() => vi.clearAllMocks());
it('does not save AI values; requires manual price, allergen confirmation and approval before existing create', async () => {
  productsAPI.create.mockResolvedValue({ id: 1 });
  const saved = vi.fn();
  render(
    <ProductModal
      storeId={3}
      categories={[{ id: 1, name: '음료' }]}
      initialDraft={{
        name: 'QA 커피',
        category_name: '음료',
        description: 'AI 초안',
        price: 99999,
        allergens: '없음',
      }}
      onClose={() => {}}
      onSave={saved}
    />
  );
  const save = screen.getByRole('button', { name: '메뉴 등록', exact: true });
  expect(save).toBeDisabled();
  expect(screen.getByPlaceholderText('0')).toHaveValue(null);
  expect(screen.getByRole('textbox', { name: '사업자 확인 알레르기' })).toHaveValue('');
  expect(productsAPI.create).not.toHaveBeenCalled();
  fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '1000' } });
  fireEvent.change(screen.getByRole('textbox', { name: '사업자 확인 알레르기' }), {
    target: { value: '우유' },
  });
  fireEvent.click(screen.getByRole('checkbox', { name: '가격을 직접 입력하고 확인했습니다.' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '알레르기 정보를 원재료와 대조했습니다.' }));
  expect(save).toBeDisabled();
  fireEvent.click(
    screen.getByRole('checkbox', { name: '초안 전체를 검토했으며 메뉴 등록을 승인합니다.' })
  );
  expect(save).toBeEnabled();
  fireEvent.click(save);
  await waitFor(() => expect(productsAPI.create).toHaveBeenCalledOnce());
  expect(productsAPI.create.mock.calls[0][0]).toMatchObject({
    store_id: 3,
    price: 1000,
    allergens: '우유',
    name: 'QA 커피',
  });
  expect(saved).toHaveBeenCalledOnce();
});
it('revokes approval when the price changes', () => {
  render(
    <ProductModal
      storeId={3}
      categories={[]}
      initialDraft={{ name: 'QA' }}
      onClose={() => {}}
      onSave={() => {}}
    />
  );
  fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '1000' } });
  fireEvent.click(screen.getByRole('checkbox', { name: '가격을 직접 입력하고 확인했습니다.' }));
  fireEvent.click(
    screen.getByRole('checkbox', { name: '원재료를 확인했고 표시할 알레르기 정보가 없습니다.' })
  );
  fireEvent.click(screen.getByRole('checkbox', { name: '알레르기 정보를 원재료와 대조했습니다.' }));
  fireEvent.click(
    screen.getByRole('checkbox', { name: '초안 전체를 검토했으며 메뉴 등록을 승인합니다.' })
  );
  fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '2000' } });
  expect(screen.getByRole('button', { name: '메뉴 등록', exact: true })).toBeDisabled();
  expect(productsAPI.create).not.toHaveBeenCalled();
});
