import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../api', () => ({
  storesAPI: { getById: vi.fn().mockResolvedValue({ data: { id: 3, name: '테스트 매장' } }) },
  tablesAPI: {
    getByStore: vi.fn().mockResolvedValue({ data: [{ id: 2, table_number: 'T02', capacity: 4, status: 'available', qr_code: 'test-qr' }] }),
    delete: vi.fn(),
    regenerateQr: vi.fn(),
  },
}));
vi.mock('../utils/socket', () => ({ getSocket: () => null }));
vi.mock('../utils/tableQr', () => ({ createQrImage: vi.fn().mockResolvedValue('data:image/png;base64,AA==') }));
vi.mock('../lib/apiList', () => ({ readApiList: value => value?.data ?? [] }));
vi.mock('../utils/apiError', () => ({ handleApiError: vi.fn() }));
vi.mock('../components/ui/Icon', () => ({ default: ({ icon }) => <span aria-hidden="true">{icon}</span> }));
vi.mock('../components/admin/VisualTableMap', () => ({ default: () => null }));

import TableManager from '../components/admin/TableManager';

const CurrentPath = () => <output data-testid="current-path">{useLocation().pathname}</output>;

describe('테이블 QR 디자인 격리', () => {
  afterEach(() => cleanup());

  it('QR 카드를 열어 디자인을 바꿔도 설정 페이지로 이동하거나 매장 테마를 바꾸지 않는다', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/stores/3/tables']}>
        <Routes>
          <Route path="/admin/stores/:storeId/tables" element={<TableManager />} />
        </Routes>
        <CurrentPath />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'QR' }));
    expect(await screen.findByRole('dialog', { name: 'T02 QR 카드' })).toBeTruthy();
    expect(screen.getByText(/매장 메뉴판 테마 설정은 변경되지 않습니다/)).toBeTruthy();

    const brandDesign = screen.getByRole('button', { name: '브랜드 오렌지' });
    fireEvent.click(brandDesign);

    await waitFor(() => expect(brandDesign.getAttribute('aria-pressed')).toBe('true'));
    expect(screen.getByTestId('current-path').textContent).toBe('/admin/stores/3/tables');
    expect(screen.queryByText('사업자 설정 및 테마 관리')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'QR 카드 닫기' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByTestId('current-path').textContent).toBe('/admin/stores/3/tables');
  });
});
