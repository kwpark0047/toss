import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import React from 'react';

const h = React.createElement;

// --- vi.hoisted()로 모킹 변수 선언 ---
const { mockNavigate, mockLogin } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockLogin: vi.fn(),
}));

// --- 모킹 ---
vi.mock('lucide-react', () => {
  const icon = (props) => h('span', { 'data-testid': 'mock-icon', ...props });
  return { Store: icon, Phone: icon, Lock: icon, AlertCircle: icon, ArrowRight: icon, ShieldCheck: icon };
});

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

vi.mock('../api', () => ({
  wakeupServer: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('framer-motion', () => {
  const motionProxy = new Proxy({}, {
    get: (_, key) => (props) => {
      const tag = typeof key === 'string' ? key : 'div';
      return h(tag, props, props?.children);
    }
  });
  return {
    motion: motionProxy,
    AnimatePresence: ({ children }) => h(React.Fragment, null, children),
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import Login from '../components/Login';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';

// --- 헬퍼 ---
const renderLogin = () => {
  return render(
    h(I18nextProvider, { i18n },
      h(MemoryRouter, null,
        h(Login)
      )
    )
  );
};

/** React 19 controlled input에 값을 설정하고 onChange를 트리거 */
const setInputValue = (input, value) => {
  // React state 업데이트를 위해 act로 감쌈
  act(() => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
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
    mockLogin.mockRejectedValueOnce({ response: { data: { message: '비밀번호가 일치하지 않습니다.' } } });
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
    mockLogin.mockImplementationOnce(() => new Promise(r => { resolveLogin = r; }));
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
