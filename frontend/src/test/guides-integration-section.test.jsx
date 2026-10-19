import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import GuidesPage from '@/pages/marketing/GuidesPage';

afterEach(cleanup);

describe('integration guidance', () => {
  it('explains supported equipment, data analysis, and the current provider readiness boundary', () => {
    render(<MemoryRouter><GuidesPage /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: '매장 장비 데이터를 연결해 한눈에 분석하기' })).toBeInTheDocument();
    expect(screen.getByText('POS·포스기')).toBeInTheDocument();
    expect(screen.getByText('키오스크·테이블오더')).toBeInTheDocument();
    expect(screen.getByText('카드단말기·PG')).toBeInTheDocument();
    expect(screen.getByText('포인트·멤버십')).toBeInTheDocument();
    expect(screen.getByText(/공통 CSV 가져오기와 인증된 API 이벤트 수집 구조/)).toBeInTheDocument();
    expect(screen.getByText(/실제 원본 데이터가 들어오기 전에는 운영 연동 완료로 표시하지 않습니다/)).toBeInTheDocument();
  });
});

