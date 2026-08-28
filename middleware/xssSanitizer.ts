import sanitizeHtml from 'sanitize-html';
import { Request, Response, NextFunction } from 'express';

// 객체 순회 보호 한계 (DoS 방지)
const MAX_DEPTH = 12;
const MAX_KEYS = 5000;

// 프로토타입 오염 차단 대상 키
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Custom sanitize options for rich text fields (if needed)
const richTextSanitizeOptions = {
  allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'a'],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href'],
  allowedSchemesByTag: {},
  selfClosing: ['br'],
  allowedClasses: {
    '*': [
      'text-*',
      'font-*',
      'bg-*',
      'border-*',
      'rounded-*',
      'p-*',
      'm-*',
      'flex',
      'grid',
      'w-*',
      'h-*',
    ],
  },
  transformTags: {
    script: sanitizeHtml.simpleTransform('p'),
    iframe: sanitizeHtml.simpleTransform('p'),
    object: sanitizeHtml.simpleTransform('p'),
    embed: sanitizeHtml.simpleTransform('p'),
    form: sanitizeHtml.simpleTransform('p'),
    input: sanitizeHtml.simpleTransform('p'),
    button: sanitizeHtml.simpleTransform('p'),
  },
};

/**
 * 위험 패턴을 제거한다.
 * 치환 후 새로운 위험 패턴이 만들어지는 우회(`<scr<script>ipt>`)를 막기 위해
 * 문자열이 안정될 때까지 반복 적용한다.
 * @param {string} val
 * @returns {string}
 */
const sanitizeString = (val: string): string => {
  if (typeof val !== 'string' || val.length === 0) return val;

  const rules = [
    // script 태그 + 내용
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    // 닫히지 않은 script/iframe/object/embed/svg onload 여는 태그
    /<\s*\/?\s*(?:script|iframe|object|embed|svg\s+onload)\b[^>]*>/gi,
    // 이벤트 핸들러 (따옴표 유무 모두)
    /\s*\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
    // 위험 스킴
    /javascript\s*:/gi,
    /vbscript\s*:/gi,
    // IE CSS expression / CSS import
    /expression\s*\(/gi,
    /@import/gi,
  ];

  let out = val;
  let prev;
  let iterations = 0;
  do {
    prev = out;
    for (const re of rules) out = out.replace(re, '');
    iterations += 1;
  } while (out !== prev && iterations < 5);

  // data: 스킴은 이미지 등 정상 용도가 있으므로 "스크립트 실행 가능한" 것만 제거한다.
  // (기존 구현은 모든 data: 를 제거해 정상 base64 이미지 업로드를 깨뜨렸다)
  out = out.replace(/data\s*:\s*text\/html/gi, '');
  out = out.replace(/data\s*:\s*image\/svg\+xml/gi, '');

  return out;
};

/**
 * 객체/배열을 깊이 우선으로 살균한다. 원본을 변형하지 않고 새 객체를 반환한다.
 */
const sanitizeDeep = (input: any, depth = 0, counter = { n: 0 }): any => {
  if (depth > MAX_DEPTH) return undefined;
  if (input === null || input === undefined) return input;

  if (typeof input === 'string') return sanitizeString(input);
  if (typeof input !== 'object') return input;

  if (Array.isArray(input)) {
    return input.map((v) => sanitizeDeep(v, depth + 1, counter));
  }

  // Date, Buffer 등은 그대로 통과 (평문 객체만 순회)
  if (input instanceof Date || Buffer.isBuffer(input)) return input;

  const out = Object.create(null);
  for (const [key, value] of Object.entries(input)) {
    if (counter.n++ > MAX_KEYS) break;
    if (FORBIDDEN_KEYS.has(key)) continue; // 프로토타입 오염 차단
    out[sanitizeString(key)] = sanitizeDeep(value, depth + 1, counter);
  }
  // Object.create(null) 은 일부 라이브러리와 호환되지 않으므로 평범한 객체로 복사
  return Object.assign({}, out);
};

// Custom sanitize options for rich text fields (if needed)
const richTextSanitizeOptions = {
  allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'a'],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href'],
  allowedSchemesByTag: {},
  selfClosing: ['br'],
  allowedClasses: {
    '*': [
      'text-*',
      'font-*',
      'bg-*',
      'border-*',
      'rounded-*',
      'p-*',
      'm-*',
      'flex',
      'grid',
      'w-*',
      'h-*',
    ],
  },
  transformTags: {
    script: sanitizeHtml.simpleTransform('p'),
    iframe: sanitizeHtml.simpleTransform('p'),
    object: sanitizeHtml.simpleTransform('p'),
    embed: sanitizeHtml.simpleTransform('p'),
    form: sanitizeHtml.simpleTransform('p'),
    input: sanitizeHtml.simpleTransform('p'),
    button: sanitizeHtml.simpleTransform('p'),
  },
};

/**
 * Advanced HTML sanitization for rich text fields
 * Use this middleware on routes that accept HTML content (e.g., product descriptions, reviews)
 * @param {string[]} fields - Array of field names to sanitize (default: ['description', 'content', 'html'])
 */
export const htmlSanitizer = (fields = ['description', 'content', 'html', 'body', 'description_html']) => {
  return (req: any, res: any, next: Function) => {
    if (!req.body || typeof req.body !== 'object') {
      return next();
    }

    const sanitize = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;

      if (Array.isArray(obj)) {
        return obj.map(sanitize);
      }

      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (FORBIDDEN_KEYS.has(key)) continue;
        // Sanitize specified fields if they contain HTML
        if (fields.includes(key) && typeof value === 'string' && value.length > 0) {
          // Check if value contains HTML-like content
          if (/<[^>]*>/.test(value)) {
            sanitized[key] = sanitizeHtml(value, richTextSanitizeOptions);
          } else {
            sanitized[key] = value;
          }
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = sanitize(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    };

    req.body = sanitize(req.body);
    next();
  };
};

/**
 * Express 5 대응: req.query 는 프로토타입의 getter 이므로 할당 대신
 * 요청 객체에 own property 를 다시 정의해 살균본을 노출한다.
 */
const redefineQuery = (req: any, sanitized: any) => {
  try {
    Object.defineProperty(req, 'query', {
      value: sanitized,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    return true;
  } catch {
    return false; // 정의 불가 환경에서는 body 살균만 적용
  }
};

/**
 * Strict sanitization for all string inputs (applied globally)
 * body + query 를 모두 살균한다.
 * (params 는 라우터가 레이어마다 재생성하므로 전역에서 고정할 수 없다.
 *  경로 파라미터는 각 라우트의 검증 스키마/parseInt 로 처리한다)
 */
export const strictSanitizer = (req: any, res: any, next: NextFunction) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeDeep(req.body);
  }

  const rawQuery = req.query;
  if (rawQuery && typeof rawQuery === 'object' && Object.keys(rawQuery).length > 0) {
    redefineQuery(req, sanitizeDeep(rawQuery));
  }

  next();
};

/**
 * @deprecated xss-clean 기반이었으나 패키지 제거(H-6)와 함께 strictSanitizer 로 통합됨.
 * 기존 호출부 호환을 위해 no-op 으로 남겨둔다.
 */
export const basicXssProtection = (req: any, res: any, next: NextFunction) => next();

export {
  sanitizeString,
  sanitizeDeep,
  richTextSanitizeOptions,
  sanitizeHtml,
  htmlSanitizer,
  strictSanitizer,
  basicXssProtection,
};