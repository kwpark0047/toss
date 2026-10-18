import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ config: vi.fn(), simpleSignup: vi.fn(), acceptAuthentication: vi.fn() }));
vi.mock('../api/freeAuth', () => ({ freeAuthAPI: mocks }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ acceptAuthentication: mocks.acceptAuthentication }) }));
vi.mock('../components/TurnstileChallenge', () => ({ default: () => null }));
vi.mock('framer-motion', () => ({ motion: { main: 'main', section: 'section' } }));

import Register from '../components/Register';

it('shows phone, email and password fields for the direct signup flow without OTP', async () => {
  mocks.config.mockResolvedValue({ simpleSignup: false });
  render(<MemoryRouter><Register /></MemoryRouter>);

  expect(await screen.findByRole('heading', { name: '위마켓 회원가입' })).toBeInTheDocument();
  expect(screen.getByLabelText('휴대전화번호')).toBeInTheDocument();
  expect(screen.getByLabelText('이메일')).toBeInTheDocument();
  expect(screen.getByLabelText('비밀번호')).toBeInTheDocument();
  expect(screen.queryByLabelText('6자리 이메일 인증번호')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '가입 설정 준비 중' })).toBeDisabled();
});

