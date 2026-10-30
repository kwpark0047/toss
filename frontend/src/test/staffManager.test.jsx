import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const { staffAPI, storesAPI } = vi.hoisted(() => ({
  staffAPI: {
    getByStore: vi.fn(),
    getMyRole: vi.fn(),
    getAttendance: vi.fn(),
    updateRole: vi.fn(),
    addExisting: vi.fn(),
  },
  storesAPI: { getById: vi.fn() },
}));

vi.mock('../api', () => ({ staffAPI, storesAPI }));
vi.mock('../utils/apiError', () => ({ handleApiError: vi.fn() }));

import StaffManager from '../components/admin/StaffManager';

const owner = { id: 1, user_id: 101, name: '매장 오너', role: 'owner', is_active: true };
const activeStaff = { id: 2, user_id: 102, name: '김매니저', email: 'manager@example.com', role: 'manager', is_active: true };
const inactiveStaff = { id: 3, user_id: 103, name: '이주방', email: 'kitchen@example.com', role: 'kitchen', is_active: false };

const renderPage = () => render(
  <MemoryRouter initialEntries={['/admin/stores/7/staff']}>
    <Routes>
      <Route path="/admin/stores/:storeId/staff" element={<StaffManager />} />
      <Route path="/admin" element={<div>관리자 홈</div>} />
    </Routes>
  </MemoryRouter>
);

describe('사업자 팀원 관리', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
    storesAPI.getById.mockResolvedValue({ data: { id: 7, name: '테스트 매장' } });
    staffAPI.getByStore.mockResolvedValue({ data: [owner, activeStaff, inactiveStaff] });
    staffAPI.getMyRole.mockResolvedValue({ data: { role: 'owner', staff_id: 1 } });
    staffAPI.getAttendance.mockResolvedValue([]);
    staffAPI.addExisting.mockResolvedValue({ data: { id: inactiveStaff.id } });
    staffAPI.updateRole.mockResolvedValue({ data: { ...activeStaff, role: 'staff' } });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('활성 팀원을 기본 표시하고 검색·역할·상태 필터를 적용한다', async () => {
    renderPage();

    expect(await screen.findByText('김매니저')).toBeInTheDocument();
    expect(screen.queryByText('이주방')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: '팀원 이름 또는 이메일 검색' }), {
      target: { value: 'manager@example.com' },
    });
    expect(screen.getByText('김매니저')).toBeInTheDocument();
    expect(screen.queryByText('매장 오너')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('팀원 이름 또는 이메일 검색'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('계정 상태 필터'), { target: { value: 'inactive' } });
    expect(screen.getByText('이주방')).toBeInTheDocument();
    expect(screen.queryByText('김매니저')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('계정 상태 필터'), { target: { value: 'all' } });
    fireEvent.change(screen.getByLabelText('역할 필터'), { target: { value: 'manager' } });
    expect(screen.getByText('김매니저')).toBeInTheDocument();
    expect(screen.queryByText('이주방')).not.toBeInTheDocument();
  });

  it('접근 해제된 팀원은 기존 계정을 삭제하지 않고 같은 역할로 매장 접근을 복원한다', async () => {
    staffAPI.getByStore
      .mockResolvedValueOnce({ data: [owner, activeStaff, inactiveStaff] })
      .mockResolvedValueOnce({ data: [owner, activeStaff, { ...inactiveStaff, is_active: true }] });
    renderPage();

    fireEvent.change(await screen.findByLabelText('계정 상태 필터'), { target: { value: 'inactive' } });
    const memberCard = screen.getByText('이주방').closest('article');
    fireEvent.click(within(memberCard).getByRole('button', { name: '접근 복원' }));

    await waitFor(() => expect(staffAPI.addExisting).toHaveBeenCalledWith({
      storeId: 7,
      userId: 103,
      role: 'kitchen',
    }));
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('이주방')).not.toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('계정 상태 필터'), { target: { value: 'active' } });
    const restoredCard = await screen.findByText('이주방').then(element => element.closest('article'));
    expect(within(restoredCard).getByText('활성')).toBeInTheDocument();
  });

  it('역할 저장 실패 시 편집을 유지하고 성공한 경우에만 목록을 다시 불러온다', async () => {
    staffAPI.updateRole.mockRejectedValueOnce(new Error('save failed'));
    renderPage();

    const memberCard = (await screen.findByText('김매니저')).closest('article');
    fireEvent.click(within(memberCard).getByRole('button', { name: '김매니저 역할 변경' }));
    fireEvent.change(within(memberCard).getByLabelText('새 역할'), { target: { value: 'staff' } });
    fireEvent.click(within(memberCard).getByRole('button', { name: '역할 변경 저장' }));

    expect(await within(memberCard).findByLabelText('새 역할')).toBeInTheDocument();
    expect(staffAPI.updateRole).toHaveBeenCalledWith(2, 'staff');

    fireEvent.click(within(memberCard).getByRole('button', { name: '역할 변경 저장' }));
    await waitFor(() => expect(staffAPI.getByStore).toHaveBeenCalledTimes(2));
    expect(within(memberCard).queryByLabelText('새 역할')).not.toBeInTheDocument();
  });
});
