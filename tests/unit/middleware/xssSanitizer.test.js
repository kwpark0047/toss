/**
 * xssSanitizer 미들웨어 테스트 (H-6 회귀 방지)
 *
 * 과거: xss-clean 이 Express 5 의 read-only req.query 에서 예외를 던져
 *       "쿼리스트링 살균을 통째로 스킵"하는 상태였다.
 * 현재: 자체 구현이 body 와 query 를 모두 살균해야 한다.
 */

// sanitize-html 은 jest.setup.js 에서 전역 목으로 대체된다(ESM 변환 회피).
// 본 테스트는 sanitize-html 에 의존하지 않는 자체 살균 로직만 검증한다.

const {
  strictSanitizer,
  sanitizeString,
  sanitizeDeep,
} = require('../../../middleware/xssSanitizer');

/** Express 5 처럼 query 를 getter 로만 노출하는 요청 객체를 만든다 */
function makeExpress5Req(query = {}, body = undefined) {
  const proto = {
    get query() {
      return query;
    },
  };
  const req = Object.create(proto);
  if (body !== undefined) req.body = body;
  return req;
}

describe('sanitizeString', () => {
  test('script 태그와 내용을 제거한다', () => {
    expect(sanitizeString('<script>alert(1)</script>hello')).toBe('hello');
  });

  test('중첩 우회(<scr<script>ipt>)도 반복 적용으로 제거한다', () => {
    const out = sanitizeString('<scr<script>ipt>alert(1)</scr</script>ipt>');
    expect(out.toLowerCase()).not.toContain('<script');
  });

  test('따옴표 없는 이벤트 핸들러도 제거한다', () => {
    expect(sanitizeString('<img src=x onerror=alert(1)>')).not.toMatch(/onerror/i);
  });

  test('따옴표 있는 이벤트 핸들러를 제거한다', () => {
    expect(sanitizeString('<div onclick="steal()">x</div>')).not.toMatch(/onclick/i);
  });

  test('javascript: / vbscript: 스킴을 제거한다', () => {
    expect(sanitizeString('javascript:alert(1)')).not.toMatch(/javascript:/i);
    expect(sanitizeString('JaVaScRiPt : alert(1)')).not.toMatch(/javascript\s*:/i);
    expect(sanitizeString('vbscript:msgbox')).not.toMatch(/vbscript:/i);
  });

  test('iframe/object/embed 여는 태그를 제거한다', () => {
    expect(sanitizeString('<iframe src="//evil"></iframe>')).not.toMatch(/iframe/i);
  });

  test('CSS expression 과 @import 를 제거한다', () => {
    expect(sanitizeString('width:expression(alert(1))')).not.toMatch(/expression\s*\(/i);
    expect(sanitizeString('@import url(evil)')).not.toMatch(/@import/i);
  });

  test('실행 가능한 data: 스킴만 제거하고 일반 이미지 data URL 은 보존한다', () => {
    expect(sanitizeString('data:text/html,<script>x</script>')).not.toMatch(
      /data\s*:\s*text\/html/i
    );
    // 정상 base64 PNG 는 깨지지 않아야 한다 (기존 구현은 모든 data: 를 제거해 파손시켰음)
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
    expect(sanitizeString(png)).toBe(png);
  });

  test('평범한 한글 문자열은 변형하지 않는다', () => {
    expect(sanitizeString('아메리카노 (ICE) 4,500원')).toBe('아메리카노 (ICE) 4,500원');
  });

  test('문자열이 아닌 값은 그대로 반환한다', () => {
    expect(sanitizeString(123)).toBe(123);
    expect(sanitizeString(null)).toBe(null);
  });
});

describe('sanitizeDeep', () => {
  test('중첩 객체/배열을 재귀 살균한다', () => {
    const out = sanitizeDeep({
      a: '<script>x</script>1',
      b: { c: ['<script>y</script>2', 3] },
    });
    expect(out.a).toBe('1');
    expect(out.b.c[0]).toBe('2');
    expect(out.b.c[1]).toBe(3);
  });

  test('__proto__ 등 프로토타입 오염 키를 제거한다', () => {
    const payload = JSON.parse('{"__proto__":{"polluted":true},"safe":"ok"}');
    const out = sanitizeDeep(payload);
    expect(out.safe).toBe('ok');
    expect(Object.prototype.polluted).toBeUndefined();
    expect(Object.keys(out)).not.toContain('__proto__');
  });

  test('Date/Buffer 는 그대로 통과한다', () => {
    const d = new Date();
    const b = Buffer.from('x');
    const out = sanitizeDeep({ d, b });
    expect(out.d).toBe(d);
    expect(out.b).toBe(b);
  });

  test('과도한 깊이는 잘라내어 DoS 를 방지한다', () => {
    let deep = 'leaf';
    for (let i = 0; i < 40; i += 1) deep = { next: deep };
    expect(() => sanitizeDeep(deep)).not.toThrow();
  });
});

describe('strictSanitizer 미들웨어', () => {
  test('body 를 살균한다', () => {
    const req = makeExpress5Req({}, { name: '<script>alert(1)</script>김철수' });
    const next = jest.fn();

    strictSanitizer(req, {}, next);

    expect(req.body.name).toBe('김철수');
    expect(next).toHaveBeenCalled();
  });

  test('[핵심 회귀] Express 5 의 read-only query 도 살균한다', () => {
    const req = makeExpress5Req({ q: '<script>alert(1)</script>커피' });
    const next = jest.fn();

    expect(() => strictSanitizer(req, {}, next)).not.toThrow();

    expect(req.query.q).toBe('커피');
    expect(next).toHaveBeenCalled();
  });

  test('query 가 비어있으면 재정의하지 않고 통과한다', () => {
    const req = makeExpress5Req({});
    const next = jest.fn();
    strictSanitizer(req, {}, next);
    expect(next).toHaveBeenCalled();
  });

  test('body 가 없어도 예외 없이 통과한다', () => {
    const req = makeExpress5Req({});
    const next = jest.fn();
    strictSanitizer(req, {}, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('query 배열 파라미터도 살균한다', () => {
    const req = makeExpress5Req({ tags: ['<script>a</script>x', 'y'] });
    const next = jest.fn();
    strictSanitizer(req, {}, next);
    expect(req.query.tags).toEqual(['x', 'y']);
  });
});
