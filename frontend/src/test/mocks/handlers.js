import { http, HttpResponse } from 'msw';

// 기본 핸들러 — 각 테스트 파일에서 필요한 API를 추가로 정의합니다.
export const handlers = [
  // 예시: http.get('/api/example', () => HttpResponse.json({ ok: true })),
];
