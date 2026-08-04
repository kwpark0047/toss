import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import React from 'react';

const h = React.createElement;

// --- vi.hoisted()로 모킹 변수 선언 ---
const { mockNavigate, mockLogin, mockVerifyLoginOtp, mockSendLoginOtp } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockLogin: vi.fn(),
  mockVerifyLoginOtp: vi.fn(),
  mockSendLoginOtp: vi.fn(),
}));

// --- 모킹 ---
vi.mock('lucide-react', () => {
  const icon = (props) => h('span', { 'data-testid': 'mock-icon', ...props });
  return {
    Store: icon,
    Phone: icon,
    Lock: icon,
    AlertCircle: icon,
    ArrowRight: icon,
    ShieldCheck: icon,
    RefreshCw: icon,
  };
});

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    socialLogin: vi.fn(),
    verifyLoginOtp: mockVerifyLoginOtp,
    sendLoginOtp: mockSendLoginOtp,
  }),
}));

vi.mock('../api', () => ({
  wakeupServer: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('framer-motion', () => {
  const motionProxy = new Proxy(
    {},
    {
      get: (_, key) => (props) => {
        const tag = typeof key === 'string' ? key : 'div';
        return h(tag, props, props?.children);
      },
    }
  );
  return {
    motion: motionProxy,
    AnimatePresence: ({ children }) => h(React.Fragment, null, children),
  };
});

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

import Login from '../components/Login';
import { MemoryRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';

// --- 헬퍼 ---
const renderLogin = () => {
  return render(h(I18nextProvider, { i18n }, h(MemoryRouter, null, h(Login))));
};

/** React 19 controlled input에 값을 설정하고 onChange를 트리거 */
const setInputValue = (input, value) => {
  // React state 업데이트를 위해 act로 감쌈
  act(() => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    ).set;
    nativeInputValueSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

const getForm = () => screen.getByRole('button', { name: /로그인/ }).closest('form');

const submitForm = () => {
  fireEvent.submit(getForm());
};

// --- formatPhone 테스트 (순수 함수) ---
// Login.jsx 내부 함수지만 동작을 직접 검증
describe('formatPhone 함수 (Login.jsx 내부)', () => {
  // formatPhone 로직을 재현
  const formatPhone = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length < 4) return digits;
    if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  };

  it('3자리 미만은 그대로 반환', () => {
    expect(formatPhone('01')).toBe('01');
  });

  it('3자리 이상 7자리 미만은 3-3 형식', () => {
    expect(formatPhone('010123')).toBe('010-123');
  });

  it('8자리 이상은 3-4-4 형식', () => {
    expect(formatPhone('01012345678')).toBe('010-1234-5678');
  });

  it('숫자만 추출되고 11자리로 제한', () => {
    expect(formatPhone('010-abc-1234-5678-extra')).toBe('010-1234-5678');
  });

  it('빈 값은 빈 문자열 반환', () => {
    expect(formatPhone('')).toBe('');
  });
});

// --- Login 컴포넌트 통합 테스트 ---
describe('Login 컴포넌트', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('로그인 폼 UI가 정상 렌더링된다', () => {
    renderLogin();

    expect(screen.getByText('매장 관리 시스템 로그인')).toBeInTheDocument();
    expect(screen.getByText('로그인')).toBeInTheDocument();
    expect(screen.getByText('핸드폰 번호')).toBeInTheDocument();
    expect(screen.getByText('비밀번호')).toBeInTheDocument();

    expect(screen.getByLabelText(/핸드폰/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByText(/계정이 없으신가요/)).toBeInTheDocument();
    expect(screen.getByText('핸드폰으로 가입하기')).toBeInTheDocument();
  });

  it('로그인 성공 시 /admin으로 이동한다', async () => {
    mockLogin.mockResolvedValueOnce({ token: 't', user: { id: 1, name: '테' } });
    renderLogin();

    // 폼 필드 값 설정
    setInputValue(screen.getByLabelText(/핸드폰/i), '010-1234-5678');
    setInputValue(screen.getByPlaceholderText('••••••••'), 'pw123');

    // 폼 전송
    submitForm();

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('010-1234-5678', 'pw123');
      expect(mockNavigate).toHaveBeenCalledWith('/admin', { replace: true });
    });
  });

  it('로그인 실패 시 에러 메시지를 표시한다', async () => {
    mockLogin.mockRejectedValueOnce({
      response: { data: { message: '비밀번호가 일치하지 않습니다.' } },
    });
    renderLogin();

    setInputValue(screen.getByLabelText(/핸드폰/i), '010-1234-5678');
    setInputValue(screen.getByPlaceholderText('••••••••'), 'wrong');
    submitForm();

    await waitFor(() => {
      expect(screen.getByText('비밀번호가 일치하지 않습니다.')).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('네트워크 에러 발생 시 에러 메시지를 표시한다', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Network Error'));
    renderLogin();

    setInputValue(screen.getByLabelText(/핸드폰/i), '010-1234-5678');
    setInputValue(screen.getByPlaceholderText('••••••••'), 'pw');
    submitForm();

    await waitFor(() => {
      expect(screen.getByText('Network Error')).toBeInTheDocument();
    });
  });

  it('로딩 중 버튼이 비활성화된다', async () => {
    let resolveLogin;
    mockLogin.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolveLogin = r;
        })
    );
    renderLogin();

    setInputValue(screen.getByLabelText(/핸드폰/i), '010-1234-5678');
    setInputValue(screen.getByPlaceholderText('••••••••'), 'pw');
    submitForm();

    // 로딩 상태 확인
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /로그인 중/ })).toBeDisabled();
    });

    resolveLogin({ token: 't', user: { id: 1, name: 't' } });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
  });

  it('가입 링크가 /register로 연결된다', () => {
    renderLogin();

    const link = screen.getByText('핸드폰으로 가입하기');
    expect(link.closest('a')).toHaveAttribute('href', '/register');
  });

  it('빈 폼 제출 시에도 handleSubmit이 호출된다', async () => {
    renderLogin();
    submitForm();

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled();
    });
  });
});

// --- 2FA 로그인 플로우 테스트 ---
describe('Login 2FA 플로우', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  /** 2FA 전환을 위해 로그인 폼을 제출하고 OTP 화면으로 이동 */
  const enterOtpStep = async () => {
    mockLogin.mockResolvedValueOnce({ twoFactorRequired: true, tempToken: 'temp-token-123' });
    renderLogin();
    setInputValue(screen.getByLabelText(/핸드폰/i), '010-1234-5678');
    setInputValue(screen.getByPlaceholderText('••••••••'), 'pw123');
    submitForm();
    await waitFor(() => {
      expect(screen.getByText('2차 인증 필요')).toBeInTheDocument();
    });
  };

  it('2FA 활성 계정은 OTP 화면으로 전환되고 즉시 로그인되지 않는다', async () => {
    await enterOtpStep();

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByLabelText('인증번호 6자리')).toBeInTheDocument();
    // 일반 로그인 폼의 가입 링크는 OTP 단계에서 숨겨진다
    expect(screen.queryByText('핸드폰으로 가입하기')).not.toBeInTheDocument();
  });

  it('OTP 인증 성공 시 tempToken과 OTP로 verify가 호출되고 /admin으로 이동한다', async () => {
    await enterOtpStep();

    setInputValue(screen.getByLabelText('인증번호 6자리'), '123456');
    fireEvent.submit(screen.getByText('2차 인증 필요').closest('form'));

    await waitFor(() => {
      expect(mockVerifyLoginOtp).toHaveBeenCalledWith('temp-token-123', '123456');
      expect(mockNavigate).toHaveBeenCalledWith('/admin', { replace: true });
    });
  });

  it('OTP 인증 실패 시 에러 메시지를 표시한다', async () => {
    mockVerifyLoginOtp.mockRejectedValueOnce({
      response: { data: { message: '인증번호가 올바르지 않거나 만료되었습니다.' } },
    });
    await enterOtpStep();

    setInputValue(screen.getByLabelText('인증번호 6자리'), '999999');
    fireEvent.submit(screen.getByText('2차 인증 필요').closest('form'));

    await waitFor(() => {
      expect(screen.getByText('인증번호가 올바르지 않거나 만료되었습니다.')).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('6자리 미만 OTP는 서버 호출 없이 검증 오류를 표시한다', async () => {
    await enterOtpStep();

    setInputValue(screen.getByLabelText('인증번호 6자리'), '123');
    fireEvent.submit(screen.getByText('2차 인증 필요').closest('form'));

    await waitFor(() => {
      expect(screen.getByText('인증번호 6자리를 입력해주세요.')).toBeInTheDocument();
    });
    expect(mockVerifyLoginOtp).not.toHaveBeenCalled();
  });

  it('인증번호 재전송이 가능하다', async () => {
    mockSendLoginOtp.mockResolvedValueOnce({ message: '인증번호가 다시 발송되었습니다.' });
    await enterOtpStep();

    fireEvent.click(screen.getByRole('button', { name: /인증번호 재전송/ }));

    await waitFor(() => {
      expect(mockSendLoginOtp).toHaveBeenCalledWith('temp-token-123');
      expect(screen.getByText('인증번호가 다시 발송되었습니다.')).toBeInTheDocument();
    });
  });

  it('로그인으로 돌아가기 버튼이 OTP 단계를 종료한다', async () => {
    await enterOtpStep();

    fireEvent.click(screen.getByRole('button', { name: /로그인으로 돌아가기/ }));

    await waitFor(() => {
      expect(screen.queryByText('2차 인증 필요')).not.toBeInTheDocument();
      expect(screen.getByText('핸드폰으로 가입하기')).toBeInTheDocument();
    });
  });
});
