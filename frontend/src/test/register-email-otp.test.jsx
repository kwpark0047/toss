import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  requestEmail: vi.fn(),
  verifyEmail: vi.fn(),
  startOAuth: vi.fn(),
  acceptAuthentication: vi.fn(),
}));

vi.mock('../api/freeAuth', () => ({
  freeAuthAPI: mocks,
  getBrowserProof: () => 'a'.repeat(64),
}));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ acceptAuthentication: mocks.acceptAuthentication }),
}));
vi.mock('../components/TurnstileChallenge', () => ({
  default: ({ onToken }) => <button onClick={() => onToken('turnstile-proof')}>보안 확인</button>,
}));

import Register from '../components/Register';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.config.mockResolvedValue({
    enabled: true,
    email: true,
    google: true,
    kakao: true,
    turnstileSiteKey: 'site-key',
    termsUrl: 'https://wemarket.example/terms',
    privacyUrl: 'https://wemarket.example/privacy',
  });
  mocks.requestEmail.mockResolvedValue({ challengeId: 'challenge-1', expiresIn: 300 });
  mocks.verifyEmail.mockResolvedValue({ token: 'access', user: { id: 7 } });
});

it('registers with email OTP only and never asks for name, phone, or SMS OTP', async () => {
  render(<MemoryRouter><Register /></MemoryRouter>);

  expect(await screen.findByRole('heading', { name: '이메일로 가입하기' })).toBeInTheDocument();
  expect(screen.getByLabelText('이메일')).toBeInTheDocument();
  expect(screen.queryByLabelText(/이름|핸드폰|휴대전화/)).toBeNull();
  const google = screen.getByRole('button', { name: 'Google로 계속하기' });
  const kakao = screen.getByRole('button', { name: '카카오로 계속하기' });
  expect(google).toBeDisabled();
  expect(kakao).toBeDisabled();

  fireEvent.click(screen.getByLabelText('이용약관에 동의합니다'));
  fireEvent.click(screen.getByLabelText('개인정보 처리방침에 동의합니다'));
  fireEvent.click(screen.getByRole('button', { name: '보안 확인' }));
  expect(google).toBeEnabled();
  expect(kakao).toBeEnabled();
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'owner@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: '이메일 인증 받기' }));

  await waitFor(() => expect(mocks.requestEmail).toHaveBeenCalledWith(expect.objectContaining({
    email: 'owner@example.com',
    purpose: 'signup',
    agreeTerms: true,
    agreePrivacy: true,
  })));
  fireEvent.change(await screen.findByLabelText('6자리 이메일 인증번호'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: '인증하고 계속하기' }));
  await waitFor(() => expect(mocks.verifyEmail).toHaveBeenCalledWith(expect.objectContaining({
    id: 'challenge-1', code: '123456',
  })));
  await waitFor(() => expect(mocks.acceptAuthentication).toHaveBeenCalledWith({ token: 'access', user: { id: 7 } }));
});

it('keeps signup unavailable when free email authentication is not enabled', async () => {
  mocks.config.mockResolvedValue({ enabled: false });
  render(<MemoryRouter><Register /></MemoryRouter>);

  expect(await screen.findByText(/이메일 인증 설정을 준비 중/)).toBeInTheDocument();
  expect(screen.queryByLabelText('이메일')).toBeNull();
  expect(screen.queryByRole('button', { name: '인증번호 받기' })).toBeNull();
});

