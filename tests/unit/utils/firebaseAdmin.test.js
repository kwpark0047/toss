/**
 * utils/firebaseAdmin 테스트 (H-5)
 *
 * firebase-admin v14 는 네임스페이스 API(admin.apps / admin.messaging())를
 * 제거했다. 이 모듈은 모듈러 API 로만 동작해야 하며, 자격 증명이 없더라도
 * 앱 기동을 막지 않아야 한다.
 *
 * firebase-admin SDK 의 가상 mock 은 전체 스위트 실행 시 worker 공유
 * 레지스트리에서 실제 모듈이 로드되는 간헐 실패가 있어, firebaseAdmin.js 의
 * 의존성 주입(deps) 파라미터로 mock 을 주입한다.
 */

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const logger = require('../../../utils/logger');
const firebaseAdmin = require('../../../utils/firebaseAdmin');

const mockGetApps = jest.fn(() => []);
const mockInitializeApp = jest.fn();
const mockCert = jest.fn((sa) => ({ _cert: sa }));
const mockDeleteApp = jest.fn(() => Promise.resolve());
const mockGetMessaging = jest.fn(() => ({ send: jest.fn() }));

const firebaseAppApi = {
  getApps: (...a) => mockGetApps(...a),
  initializeApp: (...a) => mockInitializeApp(...a),
  cert: (...a) => mockCert(...a),
  deleteApp: (...a) => mockDeleteApp(...a),
};

const firebaseMessagingApi = {
  getMessaging: (...a) => mockGetMessaging(...a),
};

function callMessaging() {
  return firebaseAdmin.getMessagingClient({
    firebaseApp: firebaseAppApi,
    firebaseMessaging: firebaseMessagingApi,
  });
}

describe('utils/firebaseAdmin', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    firebaseAdmin._resetForTests();
    mockGetApps.mockReturnValue([]);
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  });

  afterAll(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe('getMessagingClient', () => {
    test('자격 증명이 없으면 null 을 반환하고 예외를 던지지 않는다', () => {
      expect(callMessaging()).toBeNull();
      expect(mockInitializeApp).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('서비스 계정 미설정'));
    });

    test('FIREBASE_SERVICE_ACCOUNT_JSON 으로 초기화한다', () => {
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: 'demo' });

      const messaging = callMessaging();

      expect(mockCert).toHaveBeenCalledWith({ project_id: 'demo' });
      expect(mockInitializeApp).toHaveBeenCalledTimes(1);
      expect(messaging).not.toBeNull();
    });

    test('JSON 파싱 실패 시 null 을 반환한다', () => {
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{not-json';
      expect(callMessaging()).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('파싱 실패'));
    });

    test('이미 초기화된 앱이 있으면 재초기화하지 않는다', () => {
      mockGetApps.mockReturnValue([{ name: '[DEFAULT]' }]);
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: 'demo' });

      callMessaging();

      expect(mockInitializeApp).not.toHaveBeenCalled();
      expect(mockGetMessaging).toHaveBeenCalled();
    });

    test('두 번째 호출은 캐시된 인스턴스를 반환한다', () => {
      mockGetApps.mockReturnValue([{ name: '[DEFAULT]' }]);
      const first = callMessaging();
      const second = callMessaging();
      expect(second).toBe(first);
      expect(mockGetMessaging).toHaveBeenCalledTimes(1);
    });
  });

  describe('shutdownFirebase', () => {
    test('초기화된 앱을 모두 정리한다', async () => {
      const apps = [{ name: 'a' }, { name: 'b' }];
      mockGetApps.mockReturnValue(apps);

      await firebaseAdmin.shutdownFirebase({ firebaseApp: firebaseAppApi });

      expect(mockDeleteApp).toHaveBeenCalledTimes(2);
    });

    test('정리 중 예외가 나도 throw 하지 않는다', async () => {
      mockGetApps.mockImplementation(() => {
        throw new Error('boom');
      });
      await expect(
        firebaseAdmin.shutdownFirebase({ firebaseApp: firebaseAppApi })
      ).resolves.toBeUndefined();
    });
  });
});
