# WeMarket 개발 진행 현황 및 문제 재분석

검토일: 2026-10-09 KST. 대상: 현재 로컬 작업 트리. 이번 요청에서는 코드·Git·기존 실행 증거를 재검토했으며, 기능 수정·테스트 재실행·운영 DB 변경·배포는 하지 않았다. 최신 수정 보고서와 수정 전 감사의 차이를 구분한다.

## 현재 수준

**기능이 구현된 상용 파일럿이며, Production-grade SaaS 출시 게이트는 아직 충족하지 못했다. 판정은 Release Blocked이다.**

QR/메뉴/주문/관리자 기능에 더해 AI 매장 매니저, 구독, 외부 데이터 통합 기반과 보안·금융 무결성 보완 코드가 존재한다. 로컬 회귀 증거가 상당히 늘었으나, 실제 업체·PG·운영 복구와 동일 버전 배포를 인증할 증거가 부족하다. 완성도를 임의의 백분율로 표현하지 않는다.

## 코드·배포 기준

- 로컬 branch: main. HEAD: `7d0c93fd69454bf46755038bb1e8a1180ffdb476`.
- Git 확인 결과 tracked 변경 86개, untracked 항목 134개. untracked에는 디렉터리·보고서·시험 산출물이 포함되므로 신규 소스 파일 134개라는 뜻은 아니다.
- tracked diff: 788 insertions / 836 deletions. untracked 신규 서비스·migration·시험은 이 diff 합계에 포함되지 않는다.
- 현재 변경 전체를 고정한 RC commit이 없다. 이전 HEAD나 과거 원격 CI 성공을 현재 미커밋 수정본의 배포 성공으로 사용할 수 없다.
- 최신 수정의 운영 반영은 확인되지 않았다. 이번 재검토에서는 Render/Vercel 관리자 설정·배포 SHA·운영 schema·실제 계정 flag를 조회하지 않았으며, 과거 공개 health 관측을 현재 가용성으로 보고하지 않는다.

## 영역별 진행 상태

| 영역 | 현재 코드·로컬 진행 | 남은 검증 / 구현 |
|---|---|---|
| 관리자·상품·QR·PWA | 화면 및 메뉴/주문 기능 구현, 주문 상세/FCM의 loader 참조 수정, QR PC·모바일 fixture smoke 증거 있음 | 실제 QR 스캔부터 PG 결제까지 동일 staging SHA E2E, 구형 기기·느린 네트워크 시험 |
| 고객 개인정보·매장 격리 | 공개 추천에서 개인 이력 배제, store/보유 주문 capability, 인증·동의 기반 개인화 경계 보완 | 동의 발급/철회 전체 사용자 흐름, 모든 API의 실DB role×tenant 행렬, 운영 반영 |
| 인증·세션·캐시·로그 | 서버 session, refresh CAS/reuse 폐기, primary 최신 role 조회, logout 서버 폐기, CSRF 갱신, 개인 API SW cache 제거, 로그 redaction | 기존 사용자 재로그인 계획, WebSocket 즉시 회수·다중 instance 검증, cross-site cookie 브라우저 검증 |
| 결제·환불·원장·재고 | durable refund, 잔액 기반 취소, operation UNIQUE, 원장/재고 보상 및 장애 재개 시험 | 실제 Toss sandbox, 운영 과거 원장/PG 잔액 읽기 전용 대사, 순서 역전·외부 환불 대사 |
| 웹훅·자동 취소 | 암호화 inbox, provider event ID/hash, owner lease/CAS, retry/backoff, PG 호출 전 자동 취소 기록 | manual_review 처리 화면·알림·대사·재개, worker drain, 공식 event 계약 확인 |
| SaaS 구독 | 청구 claim 소유권 fencing, PG 성공 후 DB 실패 격리, entitlement transaction 보완 | sandbox 신청/갱신/실패/재시도/해지/환불, 월말·해지 경합, 운영 worker 및 대사 |
| AI 매장 매니저 | native 매출 분석, 근거·기간, 승인된 action 실행, 관측 성과 평가 구조 | 실제 모델의 injection/timeout/비용/구조 검증, 데이터 부족·장애 E2E, 외부 매출 분석 완성 |
| 외부 데이터 | adapter 계약, 표준 validation/normalization/hash, pagination/retry, lease·cursor 원자 게시, provenance 기반 구현 | 실제 provider 1곳의 adapter·OAuth lifecycle·mapping/미매핑 큐·대사·health 전체 검증 |
| DB·CI/CD | 빈 DB bootstrap, 로컬 신규 34 migration 및 기존 fixture 업그레이드 증거, CI 필수 integration/financial PG/E2E 설정 | 역사 migration checksum 영향 검토, 실제 운영 DB 업그레이드/rollback, 현재 SHA 원격 CI |
| 운영·개인정보·복구 | health/readiness·지연 초기화·일부 종료 처리·감사 코드 존재 | SLO/부하·pool/장애·alerts, 보존·삭제 정책, 실제 backup/PITR·키/파일 복구 훈련 |

## 확인한 최신 테스트 증거

아래는 저장된 최신 실행 결과를 이번 검토에서 읽은 값이다. **이번 요청에서 다시 실행한 결과는 아니다.** unit/mock·fixture browser·실DB·실제 PG를 합산해 금융 안정성을 인증하지 않는다.

| 시험 | 확인 결과 | 해석 |
|---|---|---|
| backend unit/routes/regression | 156 suites, 1,306 pass, 0 fail/skip | exit 0; --forceExit 사용, 자연 종료 증거 아님 |
| integration | 15 suites, 113 pass, 0 fail/skip | 프로세스가 종료되지 않아 중단, exit 1. assertion 성공과 CI gate 성공은 다름 |
| frontend | 25 files, 121 pass | 동일 15초 제한, worker 1개 재실행 결과 |
| SaaS | 63 pass, 0 fail/skip | 통제 provider/로컬 HTTP 시험 |
| PostgreSQL | 37 pass, 0 fail/skip | 실제 PostgreSQL transaction/unique/fencing/recovery; PG는 통제 fixture |
| QR browser | 1440/390px 통과, 오류 0 | fixture 데이터, PNG/PDF/retry; 실제 Toss 주문 여정 아님 |
| build/typecheck | frontend PWA build 및 backend typecheck exit 0 | 일부 >400kB chunk 경고 존재 |
| migration/seed | 신규 34 migration, 기존 fixture 33→34, seed 성공 | 격리 로컬 DB만 검증 |
| lint | 지정 수정 파일 exit 0 | 저장소 전체 lint 완료 아님 |

증거: reports/release-remediation-backend-final.json, integration-final.json, integration-cleanup.json, frontend-final.log, saas-final.log, postgres-final.log, qr-browser.log, build.log, bootstrap-final34.log, upgrade-final.log, seed.log, lint.log.

## 우선 해결할 문제

| 우선순위 | 문제·실제 근거 | 영향 | 다음 조치 / 완료 조건 |
|---|---|---|---|
| P0 출시 게이트 | 수정본 미커밋·운영 반영 미확인; 금융/auth 신규 schema 적용 증거 없음 | 로컬 보안·금융 개선을 유료 운영의 안전성으로 보장 불가 | 리뷰된 immutable RC SHA, 운영 적용 대상·staging 검증·schema 순서·rollback 확정 |
| P1 | integration assertion은 통과하지만 종료되지 않음. teardownIntegration.js 추가 후에도 미해결 | CI timeout·배포 차단, 열린 자원 원인 불명 | 강제 종료 없이 같은 suite exit 0, 열린 DB/socket/timer/자식 프로세스 추적 |
| P1 | 이미 적용됐을 수 있는 역사 SQL 2개 수정; render.yaml:17은 build에서 migration 실행 | journal checksum 불일치, 기존 운영 history와 다른 적용 경로 | 운영 journal을 읽기 전용 대조, 승인 가능한 migration-history/복구 계획. 임의 resolve 금지 |
| P1 | PaymentWebhookInbox.js:45–51은 legacy Subscription 및 DONE 이외 상태를 manual_review로 격리 | 장애 확산은 막지만 외부 환불·지연 이벤트가 자동 정산 완료되지 않음 | 실제 공식 Toss 계약, sandbox 역전/중복 이벤트, 대사 화면·알림·재개 및 잔액 일치 |
| P1 | SaaSBillingService.js:306–315의 PG 성공/DB 실패는 manual_review로 남음 | 서비스 권한·청구 결과가 확인 대기 상태로 장기 체류 가능 | PG authoritative 조회와 invoice/entitlement 대사, 승인 가능한 회복 절차 및 주기 검증 |
| P1 | operations-worker.cjs:17–22 작업 실행과 :27–32 종료 경로가 분리됨; stop은 진행 중 inbox Promise를 기다리지 않고 DB disconnect | 배포/중단 중 PG 성공 후 로컬 완료 기록 실패·재개 backlog 증가 가능 | 신규 claim 중지→bounded drain→DB disconnect; SIGTERM/강제종료 실DB 재개 시험 |
| P1 | socket/auth.js:43–46은 연결/수신 packet을 검증하지만 role/session 변경 후 기존 room의 서버 push까지 즉시 회수했다는 증거 없음; AuthSessionService.js:38–39 reuse 폐기는 revoke의 disconnect 경로와 별개 | 폐기된/강등된 연결의 push 수신 잔여 위험 | 다중 서버·Redis 환경에서 logout/refresh reuse/role 변경 후 protected push 0 검증 |
| P1 | canonicalAnalysis.js:12는 used_for_revenue=false; 실제 provider adapter·계정 검증 없음 | 외부 통합 매출을 AI 분석·유료 기능으로 약속하면 기능 격차 | 실제 업체 1곳 공식 테스트 계정으로 기간·금액·취소/중복·cursor·mapping·AI 근거 대사 |
| P1 | 실제 PG sandbox·전체 browser E2E·운영 복구 증거 없음 | unit 성공만으로 결제/운영 안정성을 판단할 위험 | 동일 RC SHA에서 actual PostgreSQL+Toss sandbox+browser 여정, backup/PITR 및 rollback 훈련 |
| P1 | render.yaml:12 free; 현재 dashboard 및 cold start/SLO 미확인 | 최초 고객 접속 지연 요구 미충족 가능 | 실제 운영 측정, 승인된 latency SLO·부하/장애 시험, always-on 여부·비용 별도 결정 |
| P1 | 개인정보 전체 보존·삭제, audit 불변성, 실제 PITR·암호화 키/파일 복구 미확인 | 개인정보 의무·사고 추적·복구 실패 위험 | 법무/운영 보존표, tenant 삭제·철회 검증, 복구 결과 건수/원장/격리·RPO/RTO 증거 |
| P2 | 큰 chunk, report/ZIP/배포 복사본·untracked 산출물 혼재, 단일/legacy 구독 구조 공존 | 리뷰·빌드 성능·설계 이해와 릴리스 재현성 악화 | 소스/증거 분리 및 manifest, 실제 route 성능 기준 code splitting, 구독 권위 상태·호환성 문서 |

위 P0는 로컬 코드의 재현 결함이 전부 남았다는 뜻이 아니라 **운영 출시 차단 조건**이다. P0 0개나 Production Ready를 증명한 상태가 아니다. 위 P1 코드 경로 위험은 이번 검토에서 확인했지만, 미실행 운영 환경에서 실제 사고가 발생했다고 단정하지 않는다.

## 권장 실행 순서

1. integration 자연 종료·worker drain·WebSocket 회수·금융 manual_review 운영 절차를 먼저 닫는다. 기존 실패를 skip하거나 --forceExit로 게이트를 대체하지 않는다.
2. 미커밋 변경을 기능별 리뷰하고 source/evidence manifest와 RC SHA를 확보한다. 운영 journal 대조와 schema 호환 rollback을 먼저 설계한다.
3. staging에서 신규/기존 DB 경로, 실제 PG sandbox, QR→주문→결제→환불·구독 전체 여정을 검증한다.
4. 실제 reference provider 1곳을 연결하여 매출 대사와 AI 근거를 완성한다. 미검증 provider는 운영 성공으로 표시하지 않는다.
5. SLO/부하/장애·alerts·개인정보 정책·PITR/키/파일 복구를 검증한 뒤 제한된 유료 파일럿 적용 여부를 판단한다.

이 순서를 충족하기 전 무조건 활성화/배포하는 것은 남은 위험을 제거하는 작업이 아니다. 이번 보고는 현재 증거에 근거한 개발 상태이며, 운영 활성화 승인을 대신하지 않는다.
