import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import StoreEnrichment from '../components/admin/StoreEnrichment';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'super_admin' } }),
}));

vi.mock('../api/admin', () => ({
  adminAPI: {
    enrichmentStatus: vi.fn().mockResolvedValue({
      data: {
        providers: {
          naver: {
            configured: false,
            missing: ['NAVER_CLIENT_SECRET'],
            capabilities: ['좌표', '전화번호', '업종'],
          },
          seoul: {
            configured: true,
            keyCount: 1,
            missing: [],
            capabilities: ['전화번호', '업종'],
          },
          geocoding: {
            configured: true,
            availableProviders: ['ncp'],
            missing: [],
            capabilities: ['위도', '경도'],
          },
        },
      },
    }),
  },
}));

describe('StoreEnrichment', () => {
  it('설정되지 않은 공급자만 비활성화하고 대체 지오코딩 공급자를 표시한다', async () => {
    render(<StoreEnrichment />);

    await waitFor(() => expect(screen.getByText('NAVER_CLIENT_SECRET')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: '네이버 보강 시작' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '서울 데이터 보강' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '주소→좌표 지오코딩' })).toBeEnabled();
    expect(screen.getByText('사용: ncp')).toBeInTheDocument();
  });
});
