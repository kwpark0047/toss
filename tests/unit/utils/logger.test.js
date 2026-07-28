/**
 * utils/logger export 회귀 테스트
 *
 * [배경] `const { apiLogger } = require('../utils/logger')` 형태로 쓰는 모듈이
 * 여럿 있는데 apiLogger 가 export 되지 않아 `undefined.info(...)` TypeError 로
 * newsController / weatherController 가 런타임 500 을 반환했다.
 * export 누락이 다시 발생하지 않도록 고정한다.
 */
const fs = require('fs');
const path = require('path');

const logger = require('../../../utils/logger');

const ROOT = path.resolve(__dirname, '../../..');

describe('utils/logger export', () => {
  test('기본 export 는 winston 로거다', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  test.each([
    'apiLogger',
    'dbLogger',
    'syncLogger',
    'webLogger',
    'authLogger',
    'notificationLogger',
  ])('%s 가 export 되어 있고 로그 메서드를 갖는다', (name) => {
    expect(logger[name]).toBeDefined();
    expect(typeof logger[name].info).toBe('function');
    expect(typeof logger[name].error).toBe('function');
  });

  test('소스에서 구조분해로 가져다 쓰는 모든 로거 이름이 실제 export 된다', () => {
    const dirs = ['routes', 'controllers', 'services', 'utils', 'middleware', 'repositories'];
    const used = new Set();

    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.name.endsWith('.js')) {
          const src = fs.readFileSync(full, 'utf8');
          const re = /const\s*\{([^}]+)\}\s*=\s*require\(['"][^'"]*utils\/logger['"]\)/g;
          for (const m of src.matchAll(re)) {
            m[1]
              .split(',')
              .map((s) => s.trim().split(':')[0].trim())
              .filter(Boolean)
              .forEach((n) => used.add(n));
          }
        }
      }
    };

    for (const d of dirs) {
      const full = path.join(ROOT, d);
      if (fs.existsSync(full)) walk(full);
    }

    const missing = [...used].filter((name) => logger[name] === undefined);
    expect(missing).toEqual([]);
  });
});
