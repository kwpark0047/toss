import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom이 TextEncoder/TextDecoder를 찾지 못하는 경우 대비
import { TextEncoder, TextDecoder } from 'util';
globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;

// matchMedia 폴리필 (jsdom 미지원)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// 각 테스트 후 DOM 정리
afterEach(() => {
  cleanup();
});

// MSW 핸들러에서 사용할 수 있는 기본 설정
// 실제 API 목업은 각 테스트 파일에서 msw setupServer로 추가
