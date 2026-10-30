# WeMarket 운영 배포·DB·사용자 흐름 버전 검증

**검증 기준 시각:** 2026-10-29 (KST)  
**검증 방식:** 운영 API/배포 메타데이터와 DB migration 메타데이터 읽기 전용 조회. 운영 주문·결제·회원·DB 데이터는 변경하지 않음.

## 판정 요약

**운영 프론트엔드와 백엔드는 같은 커밋을 서비스 중이며, API와 DB 연결은 확인됨. 이번 작업에서 기본 로컬 checkout을 운영 SHA에 맞추고, DB migration journal과 일치하는 별도 수정 후보를 만들었다. 운영 배포는 아직 그대로이므로 운영 서비스의 source/DB 불일치는 해소 전이다.** 복구 백업의 완전 복원과 최고관리자 외 역할의 실제 브라우저 E2E도 미검증이다.

| 검증 항목 | 결과 | 증거와 범위 |
|---|---|---|
| Vercel 운영 배포 | PASS | `wemarket-saas` 최신 Production 배포 `READY`, main, SHA `f0b728a8fc273243ab4c761299b34f13e7c59da8` |
| Render 운영 API 배포 | PASS | 서비스 `wemarket`의 현재 deploy `dep-dbgtcjmk1f9s7394lg0g` 상태 `live`, 같은 SHA `f0b728a8fc273243ab4c761299b34f13e7c59da8` |
| 운영 API·DB 연결 | PASS (표본) | Vercel `/api/health` 3회 확인, 모두 HTTP 200 JSON, `status=ok`, `db=connected`, `revision=f0b728a8fc273243ab4c761299b34f13e7c59da8`. SLO/장시간 부하 검증은 아님 |
| 기본 로컬 checkout과 운영 SHA 일치 | PASS | 루트 checkout 브랜치 `codex/live-sha-sync`, HEAD `f0b728a8fc273243ab4c761299b34f13e7c59da8`; 운영 SHA와 `git diff` 0, 추적 변경 0. 이전 브랜치 `fix/kitchen-monitor-light`의 HEAD `be7753df9ce941c16ab54b5ab3a6e7f4892ac718`는 보존함 |
| 운영 DB migration 이력 내부 정합성 | PASS (수정 후보 기준) | Supabase `kdisbvhofkyoijnawszp`의 `_prisma_migrations` 49건, 완료 49, 미완료 0, 롤백 0. 후보 branch의 migration 이름·Git blob SHA-256 49/49 일치 |
| 운영 DB와 현재 운영 SHA migration 정합성 | FAIL (운영 배포 대기) | 운영 DB에 아래 3개 migration이 적용됐으나 운영 SHA `f0b728a...` 소스에는 없음. 별도 후보 commit `6e6ae4abbf33c9f84df65021621f33a462f4f5ec`에는 세 원본을 추가했고 전체 49개 Git blob SHA-256이 DB journal 49개 체크섬과 일치함. 후보는 아직 운영에 배포되지 않음 |
| 공개 테이블 RLS 설정 | PASS (설정 플래그만) | `public` 테이블 119개 중 RLS 활성 119개. 정책의 허용 범위·역할 권한이 적절한지는 이번에 검증하지 않음 |
| DB 연결 대상 식별 | PARTIAL | 운영 health의 DB 연결은 성공. Render 환경 변수 UI에서는 연결 문자열 값이 마스킹되어 프로젝트 ID를 이번 조회에서 직접 재확인하지 못함. 사용자에게서 앞서 확인받은 프로젝트 ID와 일치한다는 독립 증거는 아님 |
| 백업 완전 복원/PITR | NOT VERIFIED | 로컬 백업 `.tmp/wemarket-backups/recovery-20261021-001720.dump`의 archive 목록은 읽힘. 격리 PostgreSQL 복원은 Supabase 전용 `supabase_vault` 확장을 로컬 서버에서 찾지 못해 실패. 백업 날짜도 DB 최신 migration(2026-10-28)보다 이전이며, 최신 시점 PITR 복원 증거는 없음. 실패한 임시 복원 데이터는 정리함 |
| 역할별 핵심 흐름 | PARTIAL | 실제 운영 최고관리자 세션으로 대시보드 화면 로드 및 매장/주문 집계 확인. 사업자·매니저·직원·주방·고객 로그인 및 주문/수납 흐름은 이번에 검증하지 않음 |
| CI/CD 게이트 | PARTIAL | 현재 운영 배포는 READY/live. 같은 SHA의 GitHub 통합 상태에는 Vercel 실패 체크가 보고되어 운영 READY와 불일치하며 원인 해소 증거가 없음 |

## 운영 DB에만 적용된 배포 누락 migration

| Migration | DB 상태 | 배포 SHA 소스 확인 |
|---|---|---|
| `20261019090000_business_access_controls` | 완료, 롤백 아님 | 없음 |
| `20261026020000_cash_transfer_payment_mode` | 완료, 롤백 아님 | 없음 |
| `20261026030000_external_mapping_guard_search_path` | 완료, 롤백 아님 | 없음 |

이는 즉시 데이터 손상을 의미한다고 단정할 수는 없지만, 현재 운영 애플리케이션 소스와 운영 DB 스키마의 기준점이 분리된 상태다. 수정 후보는 이력을 바꾸지 않고 이미 완료된 migration 파일을 source tree에 복원한다. 실제 migration 실행, 운영 DB 변경, push 및 배포는 하지 않았다.

## 이번 정합화 후보

- 별도 worktree: `.tmp/production-sha-alignment`; base는 운영 SHA `f0b728a...`.
- 로컬 branch/commit: `codex/db-migration-alignment-20261029`, `6e6ae4abbf33c9f84df65021621f33a462f4f5ec`.
- 완료된 migration SQL 원본 3개를 복구하고, 기존 migration 2개의 운영 체크섬 원본 바이트를 보존하도록 `.gitattributes`를 보정했다.
- Prisma `users` 모델에 access-control migration 컬럼을 반영하고, PostgreSQL `jsonb`인 `enabled_payment_methods`를 Prisma `Json`으로 맞췄다. 읽기는 기존 JSON 문자열도 허용하고 쓰기는 JSON 배열로 처리한다.
- 확인: `prisma validate` PASS, `prisma generate` PASS, `StoreService.test.js` 25/25 PASS, `admin-runtime.test.cjs` 3/3 PASS, `git diff --check` PASS, migration Git blob checksum 49/49 일치.
- 후보를 main에 반영하고 운영에 배포해야 실제 Vercel/Render source SHA와 DB journal이 같은 release line이 된다.

## 운영 안정성 메모

- Render 서비스는 Free 플랜이며 대시보드 안내상 유휴 시 sleep 및 다음 요청의 50초 이상 지연 가능성이 있다. 이번 건강검사 표본 성공은 cold start/응답시간 목표를 입증하지 않는다.
- `/api/health` 응답의 CORS 헤더는 `Access-Control-Allow-Origin: *`와 `Access-Control-Allow-Credentials: true`를 함께 반환했다. 브라우저는 credential 포함 cross-origin 요청에서 wildcard를 허용하지 않는다. 현재 Vercel same-origin rewrite 경로의 health는 성공했으나, 직접 Render API를 호출하는 브라우저 경로는 별도 확인이 필요하다.
- Toss 실결제·환불·웹훅, 결제 원장 대사, 백업의 Supabase 복구, 장애 복구 목표 시간은 검증하지 않았다.

## 완료 권고 순서와 종료 조건

1. **배포 소스 고정:** 운영 SHA `f0b728a...`와 DB에 필요한 세 migration이 같은 main 커밋으로 표현되도록 정합화한다. 코드/스키마 영향 검토 후 별도 승인된 배포 절차로 반영하고, 배포 후 Vercel·Render SHA를 다시 대조한다.
2. **DB 대상 확증:** Render의 `DATABASE_URL`, `DIRECT_URL`, `MIGRATION_DATABASE_URL` 프로젝트 참조 ID만 비밀값 없이 대조하고, API가 연결된 DB 식별을 확인한다.
3. **복구 입증:** Supabase 호환 격리 PostgreSQL 또는 승인된 격리 Supabase 복원 대상에서 최신 백업을 실제 복원한다. 테이블·migration 수와 핵심 관계를 집계 검증하고 복원 시각/RPO를 기록한다.
4. **역할 E2E:** 격리 staging에서 최고관리자, 사업자, 매니저, 직원, 주방, 고객 각각 로그인·권한 경계·주문 상태 흐름을 수행한다. 결제는 sandbox, 현금/이체는 합성 테스트 데이터만 사용한다.
5. **출시 게이트:** GitHub 실패 체크 원인을 해소하고 API 응답시간/cold start·부하, 웹훅/원장, 복구 절차까지 증거를 기록한다.

**현재 결론:** 기본 로컬 checkout은 운영 SHA와 정확히 일치한다. 별도 후보는 운영 DB의 49개 migration 체크섬과 일치하고 Prisma/회귀 검증도 통과했다. 그러나 후보는 아직 운영에 반영되지 않아 현재 운영 SHA와 DB migration source 불일치는 남아 있다. 복구 검증과 역할별 E2E도 미완료이므로 “코드·서비스·DB·사용자 흐름 전체가 같은 RC”라는 주장은 아직 입증되지 않았다.
