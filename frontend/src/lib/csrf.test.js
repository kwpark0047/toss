import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  fetchCsrfToken,
  attachCsrfToken,
  shouldRetryWithFreshToken,
  getCachedCsrfToken,
  __resetCsrfToken,
} from './csrf';

const API_URL = 'https://api.example.com/api';

const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

describe('lib/csrf', () => {
  beforeEach(() => {
    __resetCsrfToken();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchCsrfToken', () => {
    // 프런트(vercel.app) JS 는 API(render.com) 쿠키를 읽을 수 없으므로
    // 응답 본문으로 토큰을 받아야 한다.
    test('응답 본문(data 로 감싸진 경우)에서 토큰을 읽고 캐시한다', async () => {
      fetch.mockResolvedValue(jsonResponse({ success: true, data: { csrfToken: 'tok-1' } }));

      const token = await fetchCsrfToken(API_URL);

      expect(token).toBe('tok-1');
      expect(getCachedCsrfToken()).toBe('tok-1');
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/auth/csrf-token`,
        expect.objectContaining({
          credentials: 'include',
        })
      );
    });

    test('data 로 감싸지지 않은 응답도 처리한다', async () => {
      fetch.mockResolvedValue(jsonResponse({ csrfToken: 'tok-2' }));

      expect(await fetchCsrfToken(API_URL)).toBe('tok-2');
    });

    test('캐시가 있으면 네트워크를 다시 호출하지 않는다', async () => {
      fetch.mockResolvedValue(jsonResponse({ csrfToken: 'tok-3' }));

      await fetchCsrfToken(API_URL);
      const second = await fetchCsrfToken(API_URL);

      expect(second).toBe('tok-3');
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    // 첫 화면 로드 때 여러 요청이 동시에 나갈 수 있다 → 토큰 요청을 1회로 합친다.
    test('동시 호출은 single-flight 로 요청을 1회만 보낸다', async () => {
      fetch.mockResolvedValue(jsonResponse({ csrfToken: 'tok-4' }));

      const results = await Promise.all([
        fetchCsrfToken(API_URL),
        fetchCsrfToken(API_URL),
        fetchCsrfToken(API_URL),
      ]);

      expect(results).toEqual(['tok-4', 'tok-4', 'tok-4']);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('요청 실패해도 예외를 던지지 않고 null 을 반환한다 (CSRF 비활성 모드 허용)', async () => {
      fetch.mockRejectedValue(new Error('network down'));
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(await fetchCsrfToken(API_URL)).toBeNull();
      expect(getCachedCsrfToken()).toBeNull();
    });

    test('HTTP 오류면 null 을 반환한다', async () => {
      fetch.mockResolvedValue(jsonResponse({}, false, 500));
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(await fetchCsrfToken(API_URL)).toBeNull();
    });

    test('토큰 필드가 없으면 null 을 반환한다', async () => {
      fetch.mockResolvedValue(jsonResponse({ success: true, data: {} }));
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(await fetchCsrfToken(API_URL)).toBeNull();
    });

    test('API_URL 끝의 슬래시를 정규화한다', async () => {
      fetch.mockResolvedValue(jsonResponse({ csrfToken: 'tok-5' }));

      await fetchCsrfToken(`${API_URL}/`);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/auth/csrf-token',
        expect.anything()
      );
    });

    test('실패 후에는 inflight 가 해제되어 재시도가 가능하다', async () => {
      fetch.mockResolvedValueOnce(jsonResponse({}, false, 503));
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(await fetchCsrfToken(API_URL)).toBeNull();

      fetch.mockResolvedValueOnce(jsonResponse({ csrfToken: 'tok-6' }));
      expect(await fetchCsrfToken(API_URL)).toBe('tok-6');
    });
  });

  describe('attachCsrfToken', () => {
    test('변경 메서드에는 X-CSRF-Token 헤더를 붙인다', async () => {
      fetch.mockResolvedValue(jsonResponse({ csrfToken: 'tok-a' }));
      const config = { method: 'post', headers: {} };

      const result = await attachCsrfToken(config, API_URL);

      expect(result.headers['X-CSRF-Token']).toBe('tok-a');
    });

    // 읽기 요청에 헤더를 붙이면 불필요한 preflight 가 발생한다.
    test.each(['get', 'head', 'options'])('%s 메서드는 토큰을 붙이지 않는다', async (method) => {
      const config = { method, headers: {} };

      const result = await attachCsrfToken(config, API_URL);

      expect(result.headers['X-CSRF-Token']).toBeUndefined();
      expect(fetch).not.toHaveBeenCalled();
    });

    test('이미 헤더가 있으면 덮어쓰지 않는다', async () => {
      const config = { method: 'put', headers: { 'X-CSRF-Token': 'preset' } };

      const result = await attachCsrfToken(config, API_URL);

      expect(result.headers['X-CSRF-Token']).toBe('preset');
      expect(fetch).not.toHaveBeenCalled();
    });

    test('토큰 획득이 실패하면 헤더 없이 그대로 보낸다', async () => {
      fetch.mockRejectedValue(new Error('down'));
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const config = { method: 'delete', headers: {} };

      const result = await attachCsrfToken(config, API_URL);

      expect(result.headers['X-CSRF-Token']).toBeUndefined();
    });

    test('method 가 생략되면 안전한 메서드로 간주한다', async () => {
      const config = { headers: {} };

      const result = await attachCsrfToken(config, API_URL);

      expect(result.headers['X-CSRF-Token']).toBeUndefined();
      expect(fetch).not.toHaveBeenCalled();
    });

    test('headers 가 없어도 동작한다', async () => {
      fetch.mockResolvedValue(jsonResponse({ csrfToken: 'tok-b' }));

      const result = await attachCsrfToken({ method: 'patch' }, API_URL);

      expect(result.headers['X-CSRF-Token']).toBe('tok-b');
    });
  });

  describe('shouldRetryWithFreshToken', () => {
    const err = (config, status, data) => ({
      config,
      response: { status, data },
    });

    test('CSRF_TOKEN_INVALID 403 은 재시도 대상으로 판정하고 캐시를 비운다', async () => {
      fetch.mockResolvedValue(jsonResponse({ csrfToken: 'old' }));
      await fetchCsrfToken(API_URL);

      const config = { method: 'post', headers: {} };
      const result = shouldRetryWithFreshToken(err(config, 403, { code: 'CSRF_TOKEN_INVALID' }));

      expect(result).toBe(true);
      expect(config._csrfRetried).toBe(true);
      expect(getCachedCsrfToken()).toBeNull();
    });

    // 무한 재시도 방��: 재시도 요청이 또 실패하면 더는 재시도하지 않는다.
    test('이미 재시도한 요청은 다시 재시도하지 않는다', () => {
      const config = { method: 'post', _csrfRetried: true, headers: {} };

      expect(shouldRetryWithFreshToken(err(config, 403, { code: 'CSRF_TOKEN_INVALID' }))).toBe(
        false
      );
    });

    test('다른 403 은 재시도하지 않는다', () => {
      const config = { method: 'post', headers: {} };

      expect(shouldRetryWithFreshToken(err(config, 403, { code: 'FORBIDDEN' }))).toBe(false);
    });

    test('401 은 CSRF 문제가 아니므로 재시도하지 않는다', () => {
      const config = { method: 'post', headers: {} };

      expect(shouldRetryWithFreshToken(err(config, 401, {}))).toBe(false);
    });

    test('읽기 요청은 재시도하지 않는다', () => {
      const config = { method: 'get', headers: {} };

      expect(shouldRetryWithFreshToken(err(config, 403, { code: 'CSRF_TOKEN_INVALID' }))).toBe(
        false
      );
    });

    test('config 가 없는 에러는 재시도하지 않는다', () => {
      expect(shouldRetryWithFreshToken({ response: { status: 403 } })).toBe(false);
      expect(shouldRetryWithFreshToken(undefined)).toBe(false);
    });
  });
});
