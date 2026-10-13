import { render, screen } from '@testing-library/react';
import { test, expect, vi } from 'vitest';
vi.mock('../lib/useSEO', () => ({useSEO: () => {}}));
vi.mock('../api', () => ({default: { get: vi.fn((path, options) => {
  if (path === '/health/deep') {
    const data = {status:'degraded',checks:{database:{status:'ok'},memory:{status:'ok'},tossPayments:{status:'ok'},operationalConfig:{status:'warn'},omniroute:{status:'unavailable'}}};
    return options?.validateStatus?.(503) ? Promise.resolve(data) : Promise.reject({response:{status:503,data}});
  }
  return Promise.resolve({});
}) }}));
import SystemStatus from '../components/admin/SystemStatus';
test('503 diagnostic remains visible and does not become unknown or a fetch failure', async () => {
  render(<SystemStatus />);
  expect(await screen.findByText('운영 필수 설정 확인 필요')).toBeTruthy();
  expect(screen.getByText(/Toss 웹훅 검증 설정이 없습니다/)).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
});
