# 외부 데이터 통합 표준 · 구현 상태

상태: 공통 엔진・영속 page publication 구현. 전체 integration 코드 준비 미완료.
실제 reference 업체/API 문서 미확정, 운영 검증 미완료.
기존 CSV/API ingress는 유지한다. 수집은 분석용이며 주문 생성·결제·프로모션 실행 권한을 갖지 않는다.

## Canonical v1

공통: `entity`, `external_id`, `version`(증가하는 정수), `occurred_at`(시간대 포함 ISO), `data`.
store_id/account_id/provider는 인증된 작업에서 부여하며 provider payload로 변경하지 않는다.
금액은 KRW 정수, 환급은 양수. 고객 원문 연락처/카드번호/토큰은 canonical 데이터에 저장하지 않는다.

|모델|필수 데이터 / 의미|
|---|---|
|Store|name, timezone; 내부 매장과 명시적 연결|
|Product|name; 재고 상품, 자동 재고 변경 금지|
|MenuItem|name, product_external_id, price; 내부 상품 매핑 필요|
|Order|amount, refund_amount, status; 매출 기준, native_order_id 연결 시 중복 합산 제외|
|OrderItem|order_external_id, menu_external_id, quantity, amount|
|Payment|order_external_id, amount, status; 주문 매출에 추가 합산 금지|
|Refund|payment_external_id, amount; 결제 실행 아닌 외부 사실|
|AggregatedCustomer|customer_key, order_count; 계정 범위 가명, CRM 자동 병합 금지|
|Customer|customer_key; 동의/검증 없는 식별 정보 수집 금지|
|Promotion|name, status; 조회용, 실행은 기존 사업자 승인 흐름 필요|
|Review|rating; 원문 없이 집계, 평점 1~5|
|ExternalAccount|매장·provider·credential revision·연결/검증 상태|
|ExternalMapping|계정·외부 엔티티 ID → 동일 매장 내부 ID, 운영자가 승인|
|SyncJob|작업 ID·상태·lease/owner·시도·next_attempt·기간|
|SyncCursor|계정/stream별 opaque checkpoint, page publication과 같은 transaction|
|SyncError|작업·오류 코드·재시도 여부; secret/raw response 저장 금지|

## 처리 계약

adapter.fetchPage({cursor, window, signal, credentials}) → records/nextCursor/done →
엄격 validation → canonical normalization → 명시적 mapping → 버전/hash 중복 검출 → canonical 저장.
페이지 저장과 checkpoint는 원자적이어야 하며 stale lease owner는 publication 불가.
네트워크 호출은 DB transaction 밖에서 수행. 429/5xx/timeout만 bounded exponential backoff;
401은 재인증, malformed 데이터는 quarantine, 반복 cursor는 중단. 재수집은 기존 cursor 삭제 대신
별도 기간 작업으로 실행하고 같은 ID/version/hash는 무변경, 다른 내용은 conflict로 보류.

## 운영 완료 조건

코드 준비, 자격증명 등록, provider 검증, 실제 데이터 수집/대조 검증을 별도 상태로 관리한다.
실제 업체 문서의 pagination/증분/시간대/환불/권한 계약 확인, sandbox→실계정 읽기 동기화,
일별 업체 원장 대조, 장애/재시작/중복/credential rotation 테스트 전에는 운영 완료로 표시하지 않는다.
OAuth state/PKCE/refresh token 회전은 업체 문서 확인 후 구현한다. API key 수신과 OAuth 승인은 구분한다.

## 아직 미완료

실제 업체 adapter, 작업 생성/claim/recovery worker, Prisma 모델 반영, mapping/quarantine UI,
OAuth lifecycle, reconciliation, AI canonical 합산 및 provider 기간 provenance 운영 검증.
기존 데이터와 새 canonical 데이터를 함께 더하면 중복 매출 위험이 있으므로 대조 규칙 없이 합산하지 않는다.

## 이번 변경과 확인 결과

- services/integrations/providerPipeline.js: 모델 validation, deterministic hash, adapter 계약, 15초 timeout, 최대 4회 429/5xx retry, 반복 cursor 차단.
- runSyncPage.js: 외부 요청과 DB publication 분리, 검증 실패 시 publication 없음, 오류 message 대신 안전한 code 저장.
- SyncStore.js: tenant scoped history, lease owner fencing, 원자적 canonical page/cursor 저장, 동일 버전 충돌 rollback, 실패/재인증 상태.
- 20261008020000_canonical_sync: additive SQL 6개 테이블, composite tenant FK, active job unique, RLS, product mapping tenant trigger.
  2026-10-08 사용자 활성화 요청으로 운영 적용. targeted script 사용, 관련 없는 pending migration 미실행.
  체크섬 277394ae2b321b29ca3667e229a2f93db96d72984fd7f09c1af0db7cb5e5f530, RLS 6개 테이블 확인.
- 관리자: sync-history API와 운영 검증 미완료 표시. 기존 CSV/API ingress 변경 없음.
- 공통 엔진 6개 + 저장소 2개 단위 테스트 통과. 실제 PostgreSQL page publication 테스트 1개 통과(tenant FK, stale owner, duplicate, conflict/checkpoint rollback).
- canonicalAnalysis: canonical 최신 버전의 업체·계정·기간·표본·job 근거를 매니저 snapshot/chat 응답에 연결.
  외부 조회 장애는 unavailable 상태로 격리. 대조 미완료 자료는 추천 매출 합산에 사용하지 않는다.
- SaaS 회귀 최종 58개 통과(로컬 HTTP 테스트는 sandbox 밖에서 실행); backend typecheck, routes 88개/JSX 292개 검사 통과.
- frontend production build 통과(PWA 생성 포함). 기존 chunk size 경고는 남아 있다.
- 최초 backend 전체 회귀: 149 suites/1285 tests 통과, 현금 결제 1건 timeout.
  로컬 DB/Redis/테스트 credential을 명시한 전체 재실행은 150 suites/1286 tests 모두 통과.
  결과는 reports/external-integration-jest-isolated.json 참조. 이 검증은 실제 업체 운영 연결을 포함하지 않는다.

테스트 adapter/거래는 격리 로컬 검증용이며 reference provider 운영 성공의 근거가 아니다.
전체 기능 미완료: encrypted credentials 연결/회전·OAuth, pagination 전체 순회 worker, 증분/수동 재수집,
mapping/unmapped queue와 recovery/reconciliation, provider health, AI canonical 매출/메뉴 추천 연결.
실제 업체명과 공식 API 계약을 확보한 뒤 엔진에 붙여야 하며 현재 sync는 운영 활성화하지 않는다.
공통 저장 구조의 운영 적용과 실제 업체 자동 수집 활성화는 별도 상태이다.
