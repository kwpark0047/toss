import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ summary: vi.fn(), store: vi.fn() }));
vi.mock('../api', () => ({
  productsAPI: {},
  storesAPI: { getById: mocks.store },
  aiAPI: {},
  uploadsAPI: {},
  optionTemplatesAPI: { getAll: () => Promise.resolve({ data: [] }), list: () => Promise.resolve({ data: [] }) },
}));
vi.mock('../api/subscriptions', () => ({ subscriptionsAPI: { get: mocks.summary } }));
vi.mock('react-toastify', () => ({ toast: { warn: vi.fn(), success: vi.fn(), error: vi.fn() } }));

import { ProductModal } from '../components/admin/ProductModal';

const renderModal = () =>
  render(<ProductModal storeId={3} categories={[]} product={null} onClose={vi.fn()} onSave={vi.fn()} />);

beforeEach(() => vi.clearAllMocks());

test('a free store on the signup pro trial sees the AI image button', async () => {
  mocks.summary.mockResolvedValue({ data: { effective_plan: 'pro', trial: { active: true } } });
  mocks.store.mockResolvedValue({ data: { id: 3, plan: 'free' } });
  renderModal();
  expect(await screen.findByRole('button', { name: 'AI 이미지' })).toBeInTheDocument();
});

test('falls back to the stored plan when the subscription summary is not available', async () => {
  mocks.summary.mockRejectedValue(Object.assign(new Error('forbidden'), { status: 403 }));
  mocks.store.mockResolvedValue({ data: { id: 3, plan: 'free' } });
  renderModal();
  await waitFor(() => expect(mocks.store).toHaveBeenCalledWith(3));
  expect(screen.queryByRole('button', { name: 'AI 이미지' })).not.toBeInTheDocument();
});
