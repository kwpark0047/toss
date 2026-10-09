# 출시 단계별 실행 현황

2026-10-09 KST. 운영 배포/운영 DB/실제 PG 결제·환불은 실행하지 않았다.

## 1. 종료·금융 복구: 로컬 수정/검증

- worker/billing/outbound scheduler는 새 작업을 중지한 뒤 진행 중 작업의 Promise를 drain하고 DB를 닫는다. worker 25초 deadline에서는 성공을 표시하지 않고 exit 1로 종료하며 영속 lease/operation을 보존한다.
- Redis 캐시와 AI rate limiter의 초기화 완료 후 cleanup, 만료 타이머 정리, 실패한 Redis 연결 정리 및 native process 소유 resource registry를 구현했다. ESM/CJS로 별도 생성된 자원도 종료 대상이다.
- Jest runner의 native tsx preload가 per-suite mock 격리를 깨뜨리는 재현을 확인했다. Jest/Babel의 TS/MTS 변환으로 통일하고 CI/package의 forceExit를 제거했다.
- 신규 정상 구독 청구 실DB 시험은 paid/active와 split-store entitlement의 transaction 완료를 확인한다. stale 성공/실패 fencing도 유지한다.
- 기존 durable refund 실DB 시험은 PG 성공 후 DB 실패, 재고 실패, 별도 프로세스 재개, 중복·동시 취소, 매우 오래된 unknown의 대사 격리를 검증한다.
- PG 공식 증거가 필요한 invoice/webhook manual_review는 미해결 대사 대상으로 유지한다. 실제 운영 건을 수정하거나 재청구하지 않았다. 운영 금융 복구 완료를 선언하지 않는다.

| 시험 | 최신 결과 | 증거 |
|---|---|---|
| backend 전체, forceExit 없음 | 156 suites / 1,306 pass / exit 0 | reports/release-sequence-backend-natural.json, .log |
| integration, forceExit 없음 | 15 suites / 113 pass / exit 0 | reports/release-sequence-integration-isolated.json, .log |
| SaaS | 69 pass / 0 fail/skip / exit 0 | reports/release-sequence-saas-final2.log |
| 실제 PostgreSQL + 통제 PG | 38 pass / 0 fail/skip / exit 0 | reports/release-sequence-postgres.log |
| 변경 종료 경로 lint/typecheck | exit 0 | reports/release-sequence-lint.log, typecheck.log |
| frontend | 이전 수정본 121 pass 및 build 성공; 이번 변경은 backend/종료/시험 runner 중심 | reports/release-remediation-frontend-final.log, build.log |

실제 Toss sandbox 결과는 위 통제 PG 숫자에 포함되지 않는다. 실패/중간 로그는 보존한다. 무조건 전체 영역 Production Ready를 선언하지 않는다.

## 2. 고정 RC 소스

소스·migration·테스트·보고서를 별도 codex RC branch에 고정한다. 대형 배포 ZIP·과거 배포 복사본·미선정 reports 산출물은 commit 대상에서 제외하며 삭제하지 않는다. source 후보 credential 패턴 검사에서는 해당 패턴이 발견되지 않았다. 제한된 패턴 검사이지 비밀키 전체 부재 인증은 아니다.

RC commit SHA는 생성 후 보고한다. Git tree/manifest가 실제 대상이며, 과거 main SHA의 CI를 이 수정본의 CI로 사용하지 않는다. 운영 migration history 두 파일 변경 영향은 staging/운영 적용 전에 별도로 확인해야 한다.

pre-commit 포맷 적용 후 backend 1,306개, frontend 121개, SaaS 69개, PostgreSQL 38개를 다시 검증했고 모두 exit 0이다. 최신 증거는 reports/release-sequence-backend-rc.json/.log, frontend-rc.log, saas-rc.log, postgres-rc.log에 보관한다. 고정 RC의 변경 파일·기존 Git blob·실행 증거 hash는 reports/RELEASE_CANDIDATE_MANIFEST_2026-10-09.json에 기록한다.

## 3. staging 실제 PG·E2E

**미실행.** 저장소 config/deployment-targets.json에는 production만 있다. staging URL/DB/Toss 테스트 가맹점·키 등록 위치가 제공되지 않았다. 로컬 환경 파일에서 해당 staging 설정/키를 확인하지 못했다. Vercel의 wemarket-saas 최근 배포 5개를 읽기 조회했으며 모두 production 대상이고 최신 SHA는 기존 7d0c93fd69454bf46755038bb1e8a1180ffdb476이다. 이 조회는 backend 상태나 모든 preview 부재를 입증하지 않는다. 운영 URL이나 운영 키를 대신 사용하지 않는다. 입력 질문을 요청했으며 docs/RC_STAGING_VALIDATION_RUNBOOK.md에 실제 검증 단계와 완료 조건을 준비했다.

## 4. 실제 업체 대사

**미실행.** provider 업체명·공식 API 문서·계정이 없다. 샘플 성공을 실제 연동 성공으로 표시하지 않는다. 실제 reference와 mapping/중복 제거·기간별 원액/취소 대사 및 AI source 완성은 남아 있다.

## 5. 운영 복구 검증

**미실행.** 운영 backup/PITR 제공자 상태와 사본 복구 대상·키/파일 접근이 없다. 승인된 격리 사본에서 검증할 절차를 작성했다. 로컬 PostgreSQL 재개 시험을 운영 PITR/rollback 훈련으로 표시하지 않는다.

다음 단계는 제공된 staging/test provider 환경으로 3번을 실행하는 것이다. 순서가 필요한 실제 운영 검증을 건너뛰어 출시 판정을 올리지 않는다.
