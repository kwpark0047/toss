import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ config: vi.fn(), simpleSignup: vi.fn(), acceptAuthentication: vi.fn() }));
vi.mock('../api/freeAuth', () => ({ freeAuthAPI: mocks }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ acceptAuthentication: mocks.acceptAuthentication }) }));
vi.mock('../components/TurnstileChallenge', () => ({
  default: ({ onToken }) => <button type="button" onClick={() => onToken('turnstile-proof')}>보안 확인</button>,
}));

import Register from '../components/Register';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.config.mockResolvedValue({
    simpleSignup: true,
    signupConsentVersion: 'policy-v1',
    turnstileSiteKey: 'site-key',
    termsUrl: 'https://wemarket.example/terms',
    privacyUrl: 'https://wemarket.example/privacy',
  });
  mocks.simpleSignup.mockResolvedValue({ token: 'access', refreshToken: 'refresh', user: { id: 7 } });
});

it('creates an unverified email/password account without requesting OTP or sending an email', async () => {
  render(<MemoryRouter><Register /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: '위마켓 회원가입' })).toBeInTheDocument();
  expect(screen.queryByLabelText(/인증번호|핸드폰|휴대전화/)).toBeNull();
  expect(screen.queryByRole('button', { name: /인증번호|이메일 인증/ })).toBeNull();
  const submit = screen.getByRole('button', { name: '가입하고 시작하기' });
  expect(submit).toBeDisabled();

  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'owner@example.com' } });
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'Password123' } });
  fireEvent.click(screen.getByLabelText('이용약관에 동의합니다'));
  fireEvent.click(screen.getByLabelText('개인정보 처리방침에 동의합니다'));
  fireEvent.click(screen.getByLabelText('만 14세 이상입니다'));
  fireEvent.click(screen.getByRole('button', { name: '보안 확인' }));
  fireEvent.click(submit);

  await waitFor(() => expect(mocks.simpleSignup).toHaveBeenCalledWith(expect.objectContaining({
    email: 'owner@example.com',
    password: 'Password123',
    passwordConfirm: 'Password123',
    agreeTerms: true,
    agreePrivacy: true,
    confirmAge14: true,
    consentVersion: 'policy-v1',
    turnstileToken: 'turnstile-proof',
  })));
  await waitFor(() => expect(mocks.acceptAuthentication).toHaveBeenCalledWith({ token: 'access', refreshToken: 'refresh', user: { id: 7 } }));
});

it('does not display signup form until server feature and legal/security configuration are enabled', async () => {
  mocks.config.mockResolvedValue({ simpleSignup: false });
  render(<MemoryRouter><Register /></MemoryRouter>);
  expect(await screen.findByText(/간편 가입 설정을 준비 중/)).toBeInTheDocument();
  expect(screen.queryByLabelText('이메일')).toBeNull();
});

it('keeps the signup form to email and one password field', async () => {
  render(<MemoryRouter><Register /></MemoryRouter>);
  await screen.findByRole('heading', { name: '위마켓 회원가입' });
  expect(screen.getByLabelText('이메일')).toBeInTheDocument();
  expect(screen.getByLabelText('비밀번호')).toBeInTheDocument();
  expect(screen.queryByLabelText('이름 (선택)')).toBeNull();
  expect(screen.queryByLabelText('비밀번호 확인')).toBeNull();
});
