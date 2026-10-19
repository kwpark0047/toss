# 위마켓 최종 출시 검증 — 2026-10-20

## 판정: NO-GO

프론트엔드 잠금 의존성 설치, 프로덕션 빌드, 타입 검사와 프론트 테스트는 통과했다. 다만 운영 Supabase의 Prisma 마이그레이션 메타데이터가 `anon`·`authenticated` 역할에 공개되어 있고, 전용 staging E2E와 백업/PITR 복구가 증명되지 않았다. Render의 실제 DB 연결 및 배포 SHA도 대조하지 못했으므로 상용 출시 승인 근거가 부족하다.

운영 DB에는 이번 점검에서 DDL, 데이터 변경, 마이그레이션, 복원 작업을 수행하지 않았다. 결제·환불·인증메일을 발송하지 않았고 배포도 실행하지 않았다.

## 1. 프론트엔드 의존성·빌드·테스트

| 점검 | 결과 | 증거 |
|---|---|---|
| 잠금 파일 의존성 설치 | PASS | `frontend/package-lock.json` 기준 `npm ci` 완료, 842개 패키지 추가 |
| 프로덕션 빌드 | PASS | Vite 7.3.6, 4,161 모듈 변환, PWA 서비스 워커 생성 |
| 프론트엔드 테스트 | PASS | Vitest 4.1.11, 60개 파일·242개 테스트 통과 |
| TypeScript 타입 검사 | PASS | `npm run typecheck` 종료 코드 0 |

실행 명령은 `frontend`에서 `npm ci --prefer-offline --no-audit --no-fund --fetch-retries=2 --fetch-timeout=180000`, `npm run build`, `npm test -- --reporter=dot`, `npm run typecheck`이다. 테스트의 임시 폴더를 저장소 안으로 지정해야 Windows 샌드박스의 임시 캐시 rename `EPERM`을 피할 수 있었다. 생성한 의존성 캐시와 임시 폴더는 제거했다.

빌드 경고는 남아 있다. `src/api/wakeup.js`가 정적·동적으로 함께 import되어 별도 청크 분할이 되지 않고, 일부 번들 청크가 400KB를 넘는다. 테스트 대역에서 Framer Motion props, 주문 내역 아이콘 태그, 일부 React `act(...)` 관련 경고도 관찰됐다. 기능 테스트 실패는 없었다.

## 2. Staging 브라우저 E2E

**NOT TESTED.** 로컬 `.env.staging.local`은 개발 모드, loopback 데이터베이스, 로컬 포트 구성이다. OAuth·Turnstile·SMTP 인증 정보가 없고 해당 staging 포트에 서비스 리스너도 없었다. 이는 전용 staging 환경이 아니다. 운영 사이트는 staging으로 간주하지 않았다.

따라서 가입, Google·카카오 OAuth, Turnstile, 이메일 OTP/링크, Toss sandbox 승인·환불, 웹훅 수신, POS/배달 매출 대사는 실제 브라우저 E2E로 확인하지 않았다. 로컬 프론트 테스트 성공을 외부 연동 E2E 완료로 취급하지 않는다.

## 3. 실제 DB·백업/PITR·마이그레이션·배포 SHA

### Supabase

- 연결된 Supabase 프로젝트 목록에서 `wemarket-production-recovery` / `kdisbvhofkyoijnawszp`가 `ACTIVE_HEALTHY`로 확인됐다.
- 읽기 전용 테이블 조회에서 공개 스키마의 서비스 테이블들이 확인됐다. 이 사실만으로 기존 운영 데이터 복구가 완료됐다고 볼 수 없다. 대부분 테이블의 행 수는 0이고 `metrics`에는 1,460행이 보였다.
- Supabase 마이그레이션 목록은 `wemarket_recovery_baseline_rls`, `prisma_baseline_history_reconciliation` 두 항목이다. `public._prisma_migrations`에는 `20260101000000_baseline` 한 행이 확인됐다. 저장소의 전체 마이그레이션 적용 상태 및 실제 Render 연결 대상과의 일치는 확인되지 않았다.
- Supabase 연결 도구에서 백업 일정·PITR 보존 기간·복원 지점은 조회할 수 없었다. 실제 PITR 복원 또는 격리 대상 복원은 하지 않았다. **백업/PITR 및 데이터 복구는 NOT TESTED.**

### Render / migration gate

- Render API 연동 도구가 없고 대시보드 브라우저 연결이 오류로 중단되어 서비스 환경변수의 실제 DB 프로젝트 참조와 현재 Render 실행 SHA는 읽지 못했다. 비밀 URL을 출력하거나 추측하지 않았다.
- 저장소 `render.yaml`은 `npm ci --include=dev && npx prisma generate`로 빌드하고 `node --import tsx index.mts`로 시작하며 자동 배포는 꺼져 있다. 이 설정 자체는 빌드 중 자동 Prisma migration을 실행하지 않는다.
- `docs/RENDER_BACKEND_RESTORE.md`에는 Render build 단계에서 `prisma migrate deploy`를 실행한다고 적힌 구간이 있어 현재 `render.yaml`과 문서가 일치하지 않는다. 운영 적용 전 문서·실행 절차를 하나로 정리해야 한다.
- Vercel MCP에서 production alias `wemarket-saas.vercel.app`의 최신 배포는 `READY`, deployment `dpl_GpaUEhHCidQTq33Sm5wbSKfzt9bB`, Git SHA `2addb8712ba685509aa6e040d395ed69fefcb0d7`로 확인됐다. 로컬 HEAD는 `0fd86398f8c9e701009c1277f3431807d7781e65`이며, 워킹 트리는 126개 변경 항목이 있다. 로컬 HEAD와 Vercel SHA는 다르고 Vercel 커밋 객체는 로컬에 없다. 이 배포 SHA는 Vercel 프론트엔드에만 해당하며 Render 백엔드 SHA를 증명하지 않는다.

## 4. `public._prisma_migrations` RLS 권고와 영향

Supabase Security Advisor가 `rls_disabled_in_public`을 **ERROR / critical**로 보고했다. 읽기 전용 카탈로그 조회로 다음 사실을 확인했다.

- `public._prisma_migrations`: RLS 비활성, 정책 0개.
- `anon`과 `authenticated`에 SELECT뿐 아니라 INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER 권한까지 부여됨.
- 이 메타데이터가 공개 API 역할에 노출되면 공격자가 이력 조회·변조를 시도할 수 있고, Prisma migration 실행·운영 복구를 방해할 수 있다.

요청에 따라 RLS를 자동으로 켜거나 권한을 바꾸지 않았다. 권장 순서는 전용 비운영 DB에서 Prisma 연결 역할을 확인하고 마이그레이션 상태 검사를 재현한 다음, 공개 역할의 테이블 권한 회수와 RLS 활성화를 하나의 검토된 migration으로 적용하고, 운영 역할의 `prisma migrate status`와 정상 API 읽기·쓰기를 검증하는 것이다. RLS만 정책 없이 켜면 `anon`·`authenticated` 접근은 차단되며, 실제 Render 연결 역할이 아직 확인되지 않았으므로 운영 변경 전에 그 계정이 RLS를 우회할 권한/소유권인지 확인해야 한다.

권고 참고: [Supabase RLS 문서](https://supabase.com/docs/guides/database/postgres/row-level-security), [Security Advisor 설명](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public)

## 5. 남은 출시 차단 작업

### `_prisma_migrations` 검토용 SQL 초안 (실행하지 않음)

```sql
BEGIN;
REVOKE ALL PRIVILEGES ON TABLE public._prisma_migrations FROM anon, authenticated;
ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;
COMMIT;
```

이 변경은 공개 API 역할의 이력 조회·변조를 막지만, migration 실행 역할이 테이블 소유자 또는 `BYPASSRLS`인지 확인하지 않고 운영 적용하면 `prisma migrate status/deploy`가 실패할 수 있다. 이 내부 메타데이터 테이블에는 일반 사용자 API 정책을 추가하지 않는 방향을 우선 검토한다.

1. `_prisma_migrations`에 대한 공개 권한 회수·RLS migration을 비운영 DB에서 먼저 검증하고 운영 적용 계획을 승인받는다.
2. Render에서 실제 DB 프로젝트 ID, migration 역할, 실행 SHA를 읽기 전용으로 확인해 Supabase 복구 프로젝트와 대조한다.
3. 전용 staging DB와 도메인에서 가입·OAuth·Turnstile·이메일·Toss sandbox 결제/환불/웹훅·정산 대사를 실제 브라우저 E2E로 실행한다.
4. 보유 플랜의 백업/PITR 범위와 최근 복원 지점을 확인하고, 운영 DB가 아닌 격리된 복원 대상에 실제 복구 리허설을 수행한다.
5. Render migration 실행 단계와 복구/롤백 runbook 문서의 불일치를 해결하고, 별도 staging migration 및 재배포 SHA를 증명한다.

## 점검 경계

이 문서는 2026-10-20에 확보한 코드·테스트·읽기 전용 Supabase/Vercel 증거를 기록한다. 운영 복원, 운영 migration, 권한 변경, 배포, 실제 결제, 외부 이메일은 수행하지 않았다. 외부 연동과 계정/서비스 화면은 연결·권한 문제로 완료 검증하지 못했다.

