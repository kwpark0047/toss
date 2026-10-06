import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import PrivatePaymentProof from '../components/admin/PrivatePaymentProof';
import { paymentsAPI } from '../api';
vi.mock('../api', () => ({ paymentsAPI: { getProof: vi.fn() } }));
test('protected proof API supplies a short-lived image URL', async () => {
  paymentsAPI.getProof.mockResolvedValue({ type: 'application/json', text: async () => JSON.stringify({ data: { url: 'https://storage.example/signed-proof' } }) });
  render(<PrivatePaymentProof paymentId={19} />);
  const image = await screen.findByRole('img', { name: '입금 증빙' });
  expect(paymentsAPI.getProof).toHaveBeenCalledWith(19);
  expect(image).toHaveAttribute('src', 'https://storage.example/signed-proof');
});
test('a rejected proof request exposes no image', async () => {
  paymentsAPI.getProof.mockRejectedValue(new Error('Forbidden'));
  render(<PrivatePaymentProof paymentId={20} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('증빙을 조회하지 못했습니다');
  expect(screen.queryByRole('img')).toBeNull();
});
