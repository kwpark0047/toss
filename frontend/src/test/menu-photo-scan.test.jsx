import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import MenuScanModal from '../components/admin/MenuScanModal';
import { aiAPI, productsAPI, categoriesAPI } from '../api';
vi.mock('../api', () => ({
  aiAPI: { scanMenuImage: vi.fn() },
  productsAPI: { bulkCreate: vi.fn() },
  categoriesAPI: { create: vi.fn() },
}));
vi.mock('../utils/menuPhotoDraft', async (importOriginal) => ({
  ...(await importOriginal()),
  prepareMenuPhoto: async () => 'data:image/jpeg;base64,fixture',
}));
it('analyses only after consent and passes a safe draft to review without saving or creating categories', async () => {
  aiAPI.scanMenuImage.mockResolvedValue({
    success: true,
    suggestions: [{ name: 'QA', price: 99999, allergens: '없음' }],
  });
  const review = vi.fn();
  render(<MenuScanModal storeId={3} onClose={() => {}} onDraft={review} />);
  await act(async () =>
    fireEvent.change(screen.getByLabelText('메뉴 사진 선택'), {
      target: { files: [new File(['fixture'], 'qa.jpg', { type: 'image/jpeg' })] },
    })
  );
  expect(aiAPI.scanMenuImage).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '사진 분석 초안 만들기' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: '사진 분석 초안 만들기' }))
  );
  expect(aiAPI.scanMenuImage).toHaveBeenCalledWith(
    expect.objectContaining({ store_id: 3, consent: true })
  );
  fireEvent.click(screen.getByRole('button', { name: '이 초안을 등록 화면에서 검토' }));
  expect(review.mock.calls[0][0]).toMatchObject({ name: 'QA', price: '', allergens: '' });
  expect(productsAPI.bulkCreate).not.toHaveBeenCalled();
  expect(categoriesAPI.create).not.toHaveBeenCalled();
});
