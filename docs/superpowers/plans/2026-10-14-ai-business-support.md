# AI 사업자 성장 지원센터 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 최고관리자가 근거 기반 지원안을 전달하고 실제 매장 소유자가 승인·실행·중단·성과 확인하는 지원센터를 제공한다.

**Architecture:** 기존 StoreManagerService의 매장별 snapshot/action/evaluation을 재사용한다. 별도 지원 등록·사례·이력·dirty job 테이블로 협업과 제한된 비동기 분석을 처리하고, 주문·결제 요청 경로에서 분석을 호출하지 않는다. 사업자 승인과 플랫폼 검토를 별도 상태로 유지한다.

**Tech Stack:** React/Vite, Express, PostgreSQL/Prisma, 기존 Node 테스트 및 frontend 테스트.

**Spec:** reports/AI_BUSINESS_SUPPORT_PLAN_2026-10-14.md

## Global Constraints

- 사업자 연결·지원 동의·운영 데이터가 있는 매장만 분석한다.
- 사업자 승인 없이 할인, 문자, 광고, 발주, 지급을 실행하지 않는다.
- 현금 미수금 주문은 수금 매출로 취급하지 않는다.
- 공개 수집 매장 수와 실제 지원 가입 매장 수를 별도로 표시한다.
- 코드 준비/운영 검증 상태를 분리한다. 운영 migration·실결제·SMS는 별도 승인이다.
- 기존 QR 추천 노출만 실행 허용하며 금융·재고·외부 시스템 변경은 실행 목록에 포함하지 않는다.

## Review Focus

1. 최고관리자 역할만으로 타 매장 제안을 승인하는 우회: 실제 owner membership 검증.
2. 동의 철회 또는 소유자 변경과 worker 실행 경쟁: 실행 직전 재검증, 미완료 작업 취소.
3. 오래된 snapshot·품절·중복 클릭: 만료 및 판매 가능 여부, tenant lock, operation 고유키.
4. worker 재시작·외부 장애: lease 회수·backoff·DLQ, 주문 서비스에 오류 전파 없음.
5. 매출 표본 부족·미수금·외부 자료 중복: 근거 품질 표시와 기존 순매출 계약 유지.

## Task 1: 실제 소유자 승인 경계

**Files:** routes/storeManager.js, services/StoreManagerService.js, tests/saas/store-manager.test.cjs, tests/routes/storeManagerSupport.test.js.

**Interfaces:** `getStoreRole(userId, storeId)`의 owner 결과로 쓰기 권한을 판정한다. 플랫폼 조회 권한은 유지하되 `can_execute`는 실제 소유자만 true다. `transition(storeId,id,event,actorId,now)`에서도 소유자·승인자 재검증으로 다른 호출자의 우회를 차단한다.

- [ ] 인증 owner/manager/super_admin/타 매장 사용자 조합의 실패 재현 테스트 작성·실행.
```js
expect(await requestAs('super_admin').post(actionApprove)).toHaveProperty('status', 403);
expect(await requestAs('ownerB').post(storeAApprove)).toHaveProperty('status', 403);
```
- [ ] 읽기 API contract 유지, 승인·실행 쓰기만 실제 소유자로 제한. 기존 최고관리자 자동 승인 기능 변경 영향을 보고서에 기록.
- [ ] 중복 승인·만료·소유자 변경·판매중지·동시 실행 회귀 테스트 실행.

## Task 2: 동의·지원 사례·감사 데이터

**Files:** prisma/schema.prisma, prisma/migrations/20261014010000_business_support/migration.sql, services/BusinessSupportService.js, routes/businessSupport.js, app.mts, tests/saas/business-support.test.cjs.

**Interfaces:** `enroll(storeId,actorId,enabled)`, `listCases(filters,cursor,limit)`, `createCase(storeId,snapshotId,actionId,actorId,operationId)`, `transitionCase(storeId,id,event,actorId,operationId,note)`.

- [ ] 타 매장 snapshot/action, 중복 operation, 다른 actor 재송신 거부를 테스트.
```js
await assert.rejects(service.createCase(a, snapshotB, null, admin, op), { statusCode: 404 });
```
- [ ] enrollment(store PK, owner, consent version/date, enabled)、case(store+id unique, evidence snapshot, optional action, assignee, draft/sent/changes_requested/deferred/rejected/approved/running/stopped/completed)、event(store+case FK, actor, operation UUID unique, old/new state) を SQL constraint で保護。
- [ ] 승인 가능한 migration은 RLS·공개 접근 차단·인덱스·트랜잭션 포함. 기존 원장/고객/주문 수정 없음.
- [ ] 플랫폼은 draft/send/assign, 실제 owner는 approve/change/defer/reject/execute/stop. 실행은 승인된 연결 action에만 위임하고 같은 DB transaction에서 case 상태·audit와 함께 기록.
- [ ] 운영 DB 대신 격리 PostgreSQL에서 FK/unique/동시성/rollback 테스트. 운영 미적용 상태 명시.

## Task 3: 제한된 분석 작업·지원 우선순위

**Files:** services/BusinessSupportWorker.js, utils/businessSupportAnalysis.js, scripts/run-business-support-worker.cjs, services/BusinessSupportService.js, tests/saas/business-support-worker.test.cjs.

**Interfaces:** `markDirty(storeId,reason)`, `runBatch({limit:10,concurrency:2})`, `summarize(snapshot,operationalFacts)`.

- [ ] 비동의 매장 제외, lease 만료 회수, 5회 실패 DLQ, 재시도 간격과 동일 매장 중복 job 테스트.
```js
assert.equal(await worker.claim(nonConsentingStore), null);
assert.equal(await worker.runBatch({limit:10,concurrency:2}).maxConcurrency, 2);
```
- [ ] FOR UPDATE SKIP LOCKED·lease·bounded exponential backoff. dirty job는 enrolled store만 UNIQUE upsert하며 예약 스캔도 enrollment만 읽는다.
- [ ] 기존 5분 briefing 재사용. 매출 이상/판매불가 인기 메뉴/미접수 지연 사실은 출처·기간·품질을 보존. 원가·입금·실재고 불충분 시 자료 요청으로 표시.
- [ ] 최상위 요약은 저장된 case 집계와 cursor 50건 목록, 전체 매장별 API fanout 금지. LLM 장애는 분석 설명 fallback에 국한.
- [ ] 실패 후 재시작·동의 철회·timeout 테스트와 query plan 확인.

## Task 4: 최고관리자 지원센터·사업자 제안함

**Files:** frontend/src/api/businessSupport.js, frontend/src/components/admin/BusinessSupportCenter.jsx, frontend/src/components/admin/BusinessSupportInbox.jsx, frontend/src/components/admin/AdminLayout.jsx, frontend/src/App.jsx, frontend/src/components/admin/AIStoreManager.jsx 및 각각 테스트 파일.

**Interfaces:** `/admin/business-support`(최고관리자), `/admin/stores/:storeId/support`(매장 권한); `/api/business-support`의 목록·상세·동의·사례 전이 API.

- [ ] 권한·오류 retry·빈 목록·표본 부족·stale·pagination·중복 클릭 UI 테스트 작성.
```js
expect(screen.queryByRole('button',{name:'사업자 승인'})).not.toBeInTheDocument(); // platform view
expect(screen.getByText('자료 부족')).toBeVisible();
```
- [ ] 지원 요약/우선 목록/근거 패널/담당자/전달 이력 구현. owner 화면에 동의·수정 요청·보류·거절·승인·명시적 실행·중단 제공.
- [ ] 승인 화면에 7일 QR 메뉴 노출, 할인/문자 비용 없음, 평가 기준, 중단 경로 표시. 외부 실행 버튼 생성하지 않음.
- [ ] 전체 frontend 테스트와 build, 격리 계정별 브라우저 E2E 수행. 실사용자 동의·제안 전송은 테스트 데이터로 대체하지 않고 운영 검증 별도 기록.

## Task 5: 통합 검증·운영 인수 문서

**Files:** reports/AI_BUSINESS_SUPPORT_IMPLEMENTATION_2026-10-14.md, 보고서와 연결된 테스트 로그.

- [ ] `node scripts/run-jest.cjs --config jest.config.js tests/unit tests/routes --runInBand --no-cache`.
- [ ] `npm run test:saas`, `npm --prefix frontend test`, `npm --prefix frontend run build`.
- [ ] 격리 실DB: 동의→탐지→검토→전달→수정 요청→재전달→승인→실행→중단 및 별도 7일 성과 평가, operation 중복·worker 복구 검증.
- [ ] 변경 파일/실행 명령/결과/미검증 영역/권한 변경/운영 migration 적용·rollback·worker 무효화 절차 기록.
- [ ] 코드 완료·실DB 테스트·staging·운영 상태 분리. 실제 업체 대사, 원가/발주와 SMS 제공자 검증은 필요한 실자료/인증 없이 완료 처리하지 않는다.

## 검토 결과 및 운영 경계

이 계획은 단계 1~2의 실제 협업·실행 파이프라인과 단계 3~4의 자료 부족·실행 제한을 구현한다. 완전한 매입 시스템과 실제 SMS·업체 계약/정산 자료는 별도 도입 범위이며 버튼이나 가짜 연결로 대체하지 않는다. 최초에는 worker 운영 실행을 비활성화하고 격리 환경으로 검증한다. 운영 스키마 승인 후 별도로 소수 매장 owner 동의를 받아 활성화한다.

