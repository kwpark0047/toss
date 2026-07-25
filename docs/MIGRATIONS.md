# Prisma 마이그레이션 가이드 (#2 db push → 마이그레이션)

## 왜 `db push`가 위험한가

`prisma db push`(특히 `--accept-data-loss`)는 스키마를 DB에 강제 동기화한다.
**스키마에 없는 테이블/컬럼은 삭제**되므로, 스키마와 DB가 어긋나면(드리프트)
운영 데이터가 유실될 수 있다.

### 실제 발생했던 드리프트 (수정 완료)
`print_jobs` 테이블이 raw SQL로 생성됐으나 `schema.prisma`에 누락되어 있었다.
이 상태로 `db push`를 실행했다면 `print_jobs`가 **드롭**되었을 것이다.
→ `schema.prisma`에 `print_jobs` 모델을 추가해 드리프트를 제거했다.

## 규칙

1. **모든 스키마 변경은 `schema.prisma`를 진실 소스로** 한다. raw SQL로 만든
   테이블은 반드시 즉시 `schema.prisma`에도 모델로 반영한다.
2. 신규 변경은 `db push`가 아니라 **마이그레이션 파일**로 관리한다.
   ```bash
   npm run db:migrate        # 개발: prisma migrate dev (마이그레이션 생성+적용)
   npm run db:migrate:prod   # 운영: prisma migrate deploy (적용만, 롤백 가능 이력)
   ```
3. `db:push:force`(--accept-data-loss)는 **로컬/스테이징 초기화 전용**. 운영 금지.

## 기존 DB 마이그레이션 베이스라인 절차 (운영 DB에 최초 1회)

운영 DB는 이미 `db push`로 구성돼 마이그레이션 이력이 없다. 아래는 **데이터를
유지한 채** 마이그레이션 체계로 전환하는 안전한 순서다. 반드시 **점검 시간
(maintenance window)** 과 **백업** 후 진행한다.

```bash
# 1) 현재 스키마를 최초 마이그레이션 SQL로 생성 (적용하지 않음)
mkdir -p prisma/migrations/0_init
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql

# 2) 운영 DB에 "이미 적용됨"으로 표시 (SQL을 실행하지 않고 이력만 기록)
npx prisma migrate resolve --applied 0_init

# 3) 이후 스키마 변경부터는 정상 마이그레이션 흐름 사용
npx prisma migrate dev --name <변경명>     # 개발
npx prisma migrate deploy                   # 운영 배포
```

### 주의: Supabase `auth` 교차 스키마
이 프로젝트는 `public.activity_logs` → `auth.users` 외래키가 있어
`migrate diff`가 `P4002`(cross schema reference)를 낼 수 있다. 이 경우
`datasource db` 블록에 멀티스키마를 명시해야 한다.
```prisma
datasource db {
  provider = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
  schemas   = ["public", "auth"]   // 베이스라인 생성 시 필요
}
```
`previewFeatures = ["multiSchema"]`도 generator에 추가해야 한다. 베이스라인
생성 후 운영 영향이 없는지 검증하고 반영한다. (런타임 동작 변경 가능성이 있어
점검 시간에 진행 권장.)

## 요약
- 즉시 조치 완료: `print_jobs` 드리프트 제거 (데이터 유실 위험 해소)
- 이후 스키마 변경: `db push` 대신 `npm run db:migrate` 사용
- 운영 베이스라인 전환: 위 절차를 백업·점검 시간에 1회 수행
