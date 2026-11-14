import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import AIMarketingDrafts from '../components/admin/AIMarketingDrafts';
import { marketingDraftAPI } from '../api/marketingDrafts';
vi.mock('../api/marketingDrafts', () => ({
  marketingDraftAPI: { catalogue: vi.fn(), generate: vi.fn() },
}));
it('requires business review before local copy and revokes approval after edits or store change', async () => {
  marketingDraftAPI.catalogue.mockResolvedValue({
    data: {
      store: { id: 3, name: 'QA 매장' },
      products: [{ id: 7, name: 'QA 메뉴', price: 1000 }],
    },
  });
  marketingDraftAPI.generate.mockResolvedValue({
    data: {
      store_id: 3,
      draft_only: true,
      source: 'template',
      content: 'QA 메뉴 홍보 초안',
      hashtags: ['#QA'],
      facts: { products: [{ id: 7, name: 'QA 메뉴', price: 1000 }] },
    },
  });
  const copy = vi.fn().mockResolvedValue();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } });
  const { rerender } = render(<AIMarketingDrafts storeId={3} />);
  fireEvent.click(await screen.findByRole('checkbox', { name: /QA 메뉴/ }));
  fireEvent.click(screen.getByRole('button', { name: '초안 만들기' }));
  const button = await screen.findByRole('button', { name: '검토한 초안 복사' });
  expect(button).toBeDisabled();
  expect(copy).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('checkbox', { name: /가격·혜택·표현/ }));
  fireEvent.click(button);
  await waitFor(() => expect(copy).toHaveBeenCalledWith('QA 메뉴 홍보 초안\n\n#QA'));
  fireEvent.change(screen.getByRole('textbox', { name: '홍보 문구 초안' }), {
    target: { value: '수정한 초안' },
  });
  expect(button).toBeDisabled();
  rerender(<AIMarketingDrafts storeId={4} />);
  expect(screen.queryByDisplayValue('수정한 초안')).not.toBeInTheDocument();
});
