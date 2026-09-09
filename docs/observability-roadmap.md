# WeMarket 관측성(Observability) 롤아웃 로드맵 — Prometheus/Grafana

> **작성일**: 2026-09-09  
> **목표**: 이미 코드로 구현된 `prom-client` 메트릭을 실제 Prometheus + Grafana 스크래핑/대시보드/얼럿으로 전환  
> **현황**: 메트릭 수집·노출 코드는 완비(`app.mts`, `metrics/`) — **인프라 연동(Prometheus 서버, Grafana, 알림)만 남음**

---

## 1. 현재 구현 상태 (완료된 부분)

| 항목 | 위치 | 상태 |
|------|------|------|
| HTTP 요청 카운터/지속시간/동시실행 | `metrics/PrometheusMetrics.mts` | ✅ |
| DB(Prisma) 쿼리 지속시간 히스토그램 | `metrics/PrometheusMetrics.mts` `dbQueryDurationSeconds` | ✅ |
| 프로세스 기본 메트릭(event loop, 메모리, GC) | `initDefaultMetrics()` | ✅ |
| 라우트 카디널리티 제어(`:param` 정규화) | `normalizeRoute()` | ✅ |
| 미들웨어 전역 등록 | `app.mts` L101 `app.use(metricsMiddleware)` | ✅ |
| `/api/metrics` 스크랩 엔드포인트 | `app.mts` L384 + `metrics/metricsRouter.mts` | ✅ |
| 자체 테스트 | `tests/unit/metrics/prometheusMetrics.test.ts` | ✅ |

**요약**: 애플리케이션 계층의 "게이지"는 모두 준비됨. 남은 것은 **수집(서버)·시각화·알림** 인프라.

---

## 2. 배포 토폴로지(현행)

```
Cloudflare Worker (toss.wemarket.workers.dev)
   └── /api/* 프록시 → Render API (wemarket.onrender.com)
                          └── Express app.mts (메트릭 노출)
```

**주의사항**: `/api/metrics`가 Cloudflare Worker를 통과하므로, Worker 프록시가 이 경로를 그대로 백엔드로 전달해야 한다. 스크랩의 IP 제한은 Worker 프록시 기준으로 허용 목록을 잡아야 한다.

---

## 3. 롤아웃 단계

### Phase 1 — 메트릭 스크래핑 활성화 (P1)
- [ ] 외부 스크래퍼(예: Cloudflare Workers → Render 프록시)에 `/api/metrics` 노출 허용 규칙 검토
  - 인프라 계층(네트워크/IP)에서 접근 제한 — 코드는 이미 인증 없이 표준 텍스트 반환 설계
- [ ] Prometheus 서버 배포(또는 관리형: Grafana Cloud / Render 외부 호스팅)
- [ ] 스크랩 타깃 설정: `http://wemarket-api:PORT/api/metrics` (또는 공개 URL) 30s 간격
- [ ] Smoke test: `promtool check metrics` 로 샘플 출력 검증

### Phase 2 — Grafana 대시보드 (P1)
- [ ] Grafana 데이터소스(Prometheus) 연결
- [ ] **HTTP 성능 대시보드**
  - `rate(wemarket_http_requests_total[5m])` by (route, method, status)
  - `histogram_quantile(0.95, rate(wemarket_http_request_duration_seconds_bucket[5m]))`
  - 5xx 비율, p50/p95/p99 지연
- [ ] **DB 성능 대시보드**
  - `wemarket_db_query_duration_seconds` 분포 by (model, operation)
  - 느린 쿼리 상위 모델 추적
- [ ] **리소스 대시보드**
  - event loop lag, Node.js RSS/힙, GC (`wemarket_` 프리픽스 기본 메트릭)

### Phase 3 — 알림(Alerting) (P2)
- [ ] Alert 규칙 예시
  - 5xx 비율 > 5% (5m)
  - p95 HTTP 지연 > 2s (5m)
  - event loop lag > 500ms
  - 메모리 RSS > 80% (Render 무료/유료 티어 경계)
- [ ] 알림 채널: Slack / 이메일 연동

### Phase 4 — 레거시 통합 (P2)
- [ ] `middleware/performanceMonitor.js`(단순 duration 로그) 신규 메트릭과 이원화 정리
  - 지연 로그 유지 필요 시 Winston 로그로, 또는 메트릭으로 전환
- [ ] DB 메트릭(`dbQueryDurationSeconds`) 실제 Prisma 미들웨어/이벤트에 연결
  - 현재는 선언만 있고 실제 Prisma 쿼리 게이지를 기록하는 훅이 없음 — 연결 필요

---

## 4. 주의사항

1. **카디널리티**: `normalizeRoute`로 동적 세그먼트를 `:param`으로 치환 — 신규 라우트 추가 시
   숫자/uuid 세그먼트가 유지되지 않도록 라우트 패턴을 준수할 것.
2. **보안**: `/api/metrics`는 인증 없이 표준 텍스트를 반환 → 반드시 인프라 계층(내부망/IP 허용)에서 노출 제한.
   금융·카드 관련 민감 메트릭은 노출 금지.
3. **비용**: Render 무료 티어에서 상시 스크랩은 메모리/부하 증가 → 스크랩 주기(30s→60s) 조정 옵션.
4. **`.mts` 진입점**: `app.mts`가 TS이므로, 배포 스크립트(`vercel-build`)에서 TS 컴파일/번들 경로 확인 필요.
