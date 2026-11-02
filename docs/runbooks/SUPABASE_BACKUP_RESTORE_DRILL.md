# Supabase 백업 / PITR 복원 훈련 런북

출시 게이트 4번. 운영 DB를 **건드리지 않고** 백업이 실제로 복원 가능한지, 복구 시간이 얼마인지 측정한다.

## 0. 사전 확인 (사용자 작업)

- [ ] Supabase 운영 프로젝트 플랜 확인: 일일 백업 보존 기간, **PITR 애드온 활성 여부** (Pro 이상 + 애드온 필요)
- [ ] 복원 대상: 운영과 분리된 **신규 Supabase 프로젝트**(같은 리전 ap-southeast-1, 같은 Postgres 메이저 버전)
- [ ] 목표 수립: RPO(허용 데이터 손실 시간), RTO(허용 복구 시간)

## 1. 왜 로컬 복원이 실패했나 (`supabase_vault`)

2026-10-29 검증에서 `pg_restore` 를 일반 로컬 PostgreSQL에 실행하자 `supabase_vault` 확장을 찾지 못해 실패했다.
Supabase 덤프에는 `supabase_vault`, `pgsodium`, `pg_graphql`, `pg_net` 등 Supabase 전용 확장과 `auth`/`storage`/`vault` 스키마가 포함된다. 일반 Postgres 이미지에는 이 확장이 없다.

해결 방법(우선순위 순):

1. **Supabase 신규 프로젝트로 복원** (권장): 확장이 기본 제공된다. 대시보드 *Database → Backups → Restore to new project* 또는 PITR 시점 지정.
2. **Supabase CLI 로컬 스택** (`supabase start`): `supabase/postgres` 이미지에 확장 포함. `supabase db dump` 로 받은 SQL을 적용.
3. 일반 Postgres에 꼭 복원해야 할 때: 애플리케이션 스키마만 복원한다.
   ```bash
   pg_restore --list backup.dump > toc.txt
   # toc.txt 에서 EXTENSION supabase_vault / pgsodium / pg_graphql / pg_net, SCHEMA vault/graphql* 항목 주석 처리
   pg_restore --use-list=toc.txt --no-owner --no-privileges -d <격리 DB> backup.dump
   ```
   이 경우 `auth`/`vault` 의존 기능은 검증 범위에서 제외됨을 결과에 명시한다.

## 2. 훈련 절차

| # | 절차 | 기록 |
|---|---|---|
| 2-1 | 기준 시각 T0 기록, 운영 `/api/health` revision 기록 | 시각, SHA |
| 2-2 | 운영 `_prisma_migrations` 건수/최신 이름을 **읽기 전용 계정**으로 조회 | 건수 |
| 2-3 | 최신 일일 백업 또는 PITR(T0 - 10분)으로 **신규 프로젝트에 복원** | 시작·완료 시각 |
| 2-4 | 복원 DB에서 `_prisma_migrations` 건수 = 2-2 확인 | 일치 여부 |
| 2-5 | 핵심 테이블 행수 비교: `users`, `stores`, `orders`, `payments`, `refund_operations`, `ledger` | 표 |
| 2-6 | 복원 DB에 staging API를 연결해 `/api/health` → `db=connected` | 결과 |
| 2-7 | `docs/runbooks/ROLE_E2E_STAGING.md` 읽기 시나리오 실행 (`E2E_ALLOW_WRITES=false`) | 리포트 |
| 2-8 | RLS: `public` 테이블 RLS 활성 수가 운영과 같은지 확인 | 수 |
| 2-9 | 측정한 RTO = 2-3 시작 ~ 2-6 성공, RPO = T0 - 복원 시점 | 분 |

## 3. 정리

- [ ] 복원 프로젝트에는 운영 개인정보가 있으므로 훈련 직후 삭제 (또는 접근 제한 후 기한 내 삭제)
- [ ] 로컬에 받은 덤프(`.tmp/wemarket-backups/*`)는 암호화 보관 또는 삭제. `.tmp/` 는 gitignore 대상이지만 디스크에 남는다
- [ ] 결과를 `docs/verification/BACKUP_RESTORE_DRILL_<날짜>.md` 로 기록

## 4. 판정 기준

복원 성공 + 마이그레이션·행수 일치 + 역할 읽기 E2E 통과 + RTO/RPO 가 목표 이내일 때 게이트 4번 완료.
