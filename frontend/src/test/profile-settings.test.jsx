import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { test, expect, vi } from 'vitest';
const auth = vi.hoisted(() => ({user:{id:1,name:'관리자',role:'super_admin',email:null,address:null},updateProfile:vi.fn(),refreshProfile:vi.fn(),getTwoFactorStatus:vi.fn(),changePassword:vi.fn(),sendTwoFactorOtp:vi.fn(),verifyTwoFactorOtp:vi.fn()}));
vi.mock('../contexts/AuthContext', () => ({useAuth: () => auth}));
import ProfilePage from '../pages/ProfilePage';
test('loads full profile and submits an email edit without changing the role', async () => {
  auth.refreshProfile.mockResolvedValue(auth.user); auth.getTwoFactorStatus.mockResolvedValue(false); auth.updateProfile.mockResolvedValue({...auth.user,email:'owner@example.com'});
  render(<ProfilePage />);
  await waitFor(() => expect(auth.refreshProfile).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button',{name:'이메일 추가'}));
  fireEvent.change(screen.getByRole('textbox',{name:'이메일'}),{target:{value:'owner@example.com'}});
  fireEvent.click(screen.getByRole('button',{name:'저장',exact:true}));
  await waitFor(() => expect(auth.updateProfile).toHaveBeenCalledWith({email:'owner@example.com'}));
});
test('failed two-factor lookup cannot present disabled state as confirmed', async () => {
  auth.getTwoFactorStatus.mockRejectedValue(Error('offline'));
  render(<ProfilePage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('2단계 인증 상태를 확인하지 못했습니다');
});
test('duplicate email explains the reason and preserves the entered value', async () => {
  auth.getTwoFactorStatus.mockResolvedValue(false);
  auth.updateProfile.mockRejectedValue({response:{status:409}});
  render(<ProfilePage />);
  fireEvent.click(screen.getByRole('button',{name:'이메일 추가'}));
  const input = screen.getByRole('textbox',{name:'이메일'});
  fireEvent.change(input,{target:{value:'owner@example.com'}});
  fireEvent.click(screen.getByRole('button',{name:'저장',exact:true}));
  expect(await screen.findByRole('alert')).toHaveTextContent('다른 계정에서 사용 중');
  expect(input).toHaveValue('owner@example.com');
});
