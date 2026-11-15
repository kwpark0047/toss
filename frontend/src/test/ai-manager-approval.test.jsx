import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import AIStoreManager from '../components/admin/AIStoreManager';
import { storeManagerAPI } from '../api/storeManager';
vi.mock('../api/storeManager', () => ({
  storeManagerAPI: { briefing: vi.fn(), transition: vi.fn() },
}));
vi.mock('../components/admin/AIManagerLive', () => ({
  default: ({ onReviewActions }) => <button onClick={onReviewActions}>Live에서 제안 보기</button>,
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
const data = (can_execute) => ({
  store: { id: 3, name: 'QA' },
  can_execute,
  historical: { days: 0 },
  actions: [
    {
      id: 'qa',
      status: 'proposed',
      created_at: new Date().toISOString(),
      payload: { title: 'QA 제안', reason: '테스트' },
    },
  ],
});
const mount = () =>
  render(
    <MemoryRouter initialEntries={['/stores/3/manager']}>
      <Routes>
        <Route path="/stores/:storeId/manager" element={<AIStoreManager />} />
      </Routes>
    </MemoryRouter>
  );
it('keeps approval separate from execution and honors final owner confirmation', async () => {
  vi.stubEnv('VITE_AI_LIVE_UI_ENABLED', 'true');
  const initial = data(true);
  storeManagerAPI.briefing
    .mockResolvedValueOnce({ data: initial })
    .mockResolvedValue({
      data: { ...initial, actions: [{ ...initial.actions[0], status: 'approved' }] },
    });
  storeManagerAPI.transition.mockResolvedValue({});
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  mount();
  fireEvent.click(await screen.findByRole('button', { name: '제안 승인' }));
  await waitFor(() =>
    expect(storeManagerAPI.transition).toHaveBeenCalledWith('3', 'qa', 'approve')
  );
  const execute = await screen.findByRole('button', { name: '미리보기 확인 후 적용' });
  fireEvent.click(execute);
  expect(confirm).toHaveBeenCalledOnce();
  expect(storeManagerAPI.transition).toHaveBeenCalledTimes(1);
  confirm.mockReturnValue(true);
  fireEvent.click(execute);
  await waitFor(() =>
    expect(storeManagerAPI.transition).toHaveBeenCalledWith('3', 'qa', 'execute')
  );
});
it('does not expose owner mutations to a manager and Live navigation never executes', async () => {
  vi.stubEnv('VITE_AI_LIVE_UI_ENABLED', 'true');
  storeManagerAPI.briefing.mockResolvedValue({ data: data(false) });
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Live에서 제안 보기' }));
  expect(screen.queryByRole('button', { name: '제안 승인' })).not.toBeInTheDocument();
  expect(storeManagerAPI.transition).not.toHaveBeenCalled();
});
