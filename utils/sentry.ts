import { createRequire } from 'node:module';
import path from 'node:path';

// 정본은 utils/sentry.js 다 (@sentry/node 지연 로드 + PII 정화). tsx 가 TS 기준 './sentry.js' 를
// 이 .ts 로 되돌려 해석하므로 JS 경로를 기준점으로 require 해 errorHandler/alerting 과 같은
// 인스턴스를 초기화한다. 예전 .ts 구현은 DSN 이 없어도 @sentry/node 를 즉시 import 해
// 기동 시간의 1/3 가량을 썼고, 초기화 상태도 JS 쪽과 공유되지 않았다.
const requireFromJs = createRequire(path.join(__dirname, 'sentry.js'));
const sentry = requireFromJs('./sentry.js');

export const initSentry: () => unknown = sentry.initSentry;
export const captureException: (err: unknown, opts?: unknown) => void = sentry.captureException;
export const captureMessage: (message: string, level?: string, context?: unknown) => void =
  sentry.captureMessage;

export default sentry;
