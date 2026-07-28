/**
 * 라우트 마운트 정합성 테스트 (M-2)
 *
 * 배경: `routes/news.js` 는 routes 맵에 require 되어 있었지만 app.use 로 마운트되지
 *       않아 프론트엔드의 /api/news 호출이 전부 404 였다. 같은 유형의 실수를 막는다.
 *
 * app.js 를 실제로 로드하면 DB/Socket 등 부작용이 크므로 소스를 정적 분석한다.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const APP_SOURCE = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

/** routes 맵(`key: require('./routes/x')`)에 등록된 키 목록 */
function getRegisteredRouteKeys(source) {
  const mapMatch = source.match(/const routes = \{([\s\S]*?)\n\};/);
  if (!mapMatch) return [];
  return [...mapMatch[1].matchAll(/^\s*(\w+):\s*require\(/gm)].map((m) => m[1]);
}

/** app.use(...) 에서 실제 사용된 routes.<key> 목록 */
function getMountedRouteKeys(source) {
  return [...source.matchAll(/app\.use\([^)]*routes\.(\w+)/g)].map((m) => m[1]);
}

describe('app.js 라우트 마운트 정합성', () => {
  test('routes 맵에 등록된 모든 라우터가 실제로 마운트되어 있다', () => {
    const registered = getRegisteredRouteKeys(APP_SOURCE);
    const mounted = new Set(getMountedRouteKeys(APP_SOURCE));

    expect(registered.length).toBeGreaterThan(20); // 파싱 실패 방지용 sanity check

    const orphaned = registered.filter((k) => !mounted.has(k));
    expect(orphaned).toEqual([]);
  });

  test('news 라우트가 마운트되어 있다 (M-2 회귀 방지)', () => {
    expect(APP_SOURCE).toMatch(/app\.use\([^)]*\/news`?,[^)]*routes\.news/);
  });

  test('삭제된 routes/monitoring.js 를 더 이상 참조하지 않는다', () => {
    expect(APP_SOURCE).not.toContain("require('./routes/monitoring')");
    expect(fs.existsSync(path.join(ROOT, 'routes/monitoring.js'))).toBe(false);
  });

  test('routes/ 의 모든 파일이 app.js 에서 참조된다 (고아 파일 방지)', () => {
    const routeFiles = fs
      .readdirSync(path.join(ROOT, 'routes'))
      .filter((f) => f.endsWith('.js'))
      .map((f) => f.replace(/\.js$/, ''));

    const orphanFiles = routeFiles.filter((name) => !APP_SOURCE.includes(`./routes/${name}'`));

    expect(orphanFiles).toEqual([]);
  });
});
