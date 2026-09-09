/**
 * config/authConstants 단위 테스트 (AC6 — OTP 만료 상수화 검증)
 *
 * 검증 포인트:
 *   1. 기본 OTP 만료시간은 5분(300,000ms).
 *   2. 환경변수 OTP_EXPIRY_MS 로 런타임 오버라이드 가능.
 *
 * 주의: authConstants 는 require 시점에 process.env 를 읽으므로,
 * 각 케이스는 jest.resetModules() 후 env 를 설정/삭제해 재-require 한다.
 */
describe('config/authConstants — OTP_EXPIRY_MS', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    delete process.env.OTP_EXPIRY_MS;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('기본값은 5분(300,000ms)이다 (OTP_EXPIRY_MS 미설정)', () => {
    const { OTP_EXPIRY_MS } = require('../../../config/authConstants');
    expect(OTP_EXPIRY_MS).toBe(5 * 60 * 1000);
    expect(OTP_EXPIRY_MS).toBe(300000);
  });

  test('환경변수 OTP_EXPIRY_MS 가 있으면 오버라이드된다', () => {
    process.env.OTP_EXPIRY_MS = '60000';
    const { OTP_EXPIRY_MS } = require('../../../config/authConstants');
    expect(OTP_EXPIRY_MS).toBe(60000);
  });

  test('환경변수가 0 또는 NaN 이면 기본(5분)으로 폴백된다', () => {
    process.env.OTP_EXPIRY_MS = '0';
    const first = require('../../../config/authConstants').OTP_EXPIRY_MS;
    expect(first).toBe(5 * 60 * 1000);

    jest.resetModules();
    process.env.OTP_EXPIRY_MS = 'not-a-number';
    const second = require('../../../config/authConstants').OTP_EXPIRY_MS;
    expect(second).toBe(5 * 60 * 1000);
  });
});
