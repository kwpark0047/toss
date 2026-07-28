# Prisma 마이그레이션 운영 가이드

> **배경 (H-4)**: 이 프로젝트는 오랫동안 `prisma db push` 로 스키마를 반영해 왔다.
> 모델이 54개까지 늘어난 상태에서 `db push` 는
> **스키마 드리프트 / 롤백 불가 / 변경 리뷰 불가**를 의미한다.
> 결제·원장(ledger)·정산(settlements)을 다루는 서비스에서는 허용할 수 없는 부채이므로
> 마이그레이션 히스토리를 도입했다.

---

## 1. 디렉터리 구조

```
prisma/migrations/
├── 20260101000000_baseline/
│   └── migration.sql          # 현재 스키마 전체(54 테이블/106 인덱스/74 FK) 스냅샷
prisma/legacy-migrations/       # 도입 이전 수동 실행 SQL (참고용, 실행 대상 아님)
├── 20260703_payment_settlement_upgrade.sql
└── 20260704_legal_compliance.sql
```

수동 SQL은 `prisma/migrations/` 밖에 둔다. Prisma는 마이그레이션 디렉터리의
모든 하위 폴더를 검사하므로, 이 안에 `migration.sql`이 없는 보관 폴더를 두면
`migrate deploy`가 실패할 수 있다. 과거 DDL 추적용 파일은
`prisma/legacy-migrations/`에서 기록으로만 보존한다.

---

## 2. 기존 운영 DB에 베이스라인 적용 (최초 1회)

운영 DB에는 이미 모든 테이블이 존재하므로 **베이스라인을 "실행"하면 안 되고
"적용된 것으로 표시"만 해야 한다.**

```bash
# 1) 운영 DATABASE_URL 로 연결된 상태에서
npx prisma migrate resolve --applied 20260101000000_baseline

# 2) 드리프트 확인 — 아무 것도 출력되지 않아야 정상
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel  prisma/schema.prisma \
  --script
```

2번에서 SQL 이 출력되면 실제 DB 와 `schema.prisma` 가 어긋나 있다는 뜻이다.
이 경우 출력된 SQL 을 검토해 별도 마이그레이션으로 승격시킨다.

```bash
npm run db:migrate:baseline   # 위 1) 을 감싼 스크립트
npm run db:drift              # 위 2) 를 감싼 스크립트
```

---

## 3. 신규 개발 DB 부트스트랩

```bash
npx prisma migrate deploy     # baseline 부터 순차 실행
npx prisma generate
```

---

## 4. 앞으로의 스키마 변경 절차

```bash
# 1. schema.prisma 수정
# 2. 로컬 개발 DB에 마이그레이션 생성 + 적용
npm run db:migrate -- --name add_subscription_table

# 3. 생성된 prisma/migrations/<ts>_add_subscription_table/migration.sql 을 코드리뷰에 포함
# 4. 배포 시 자동 적용
npm run db:migrate:prod       # prisma migrate deploy
```

### 금지 사항

| 금지 | 이유 |
|---|---|
| 운영/스테이징에서 `prisma db push` | 히스토리 없이 스키마가 바뀌어 드리프트 발생 |
| `prisma db push --accept-data-loss` | 데이터 삭제 위험 |
| `migration.sql` 을 사후 편집 | 체크섬 불일치로 `migrate deploy` 실패 |

`npm run db:push` 는 `NODE_ENV=production` 에서 실행되면
`scripts/guard-db-push.js` 가 종료 코드 1 로 차단한다.

---

## 5. 파괴적 변경 시 체크리스트

- [ ] 컬럼 삭제/타입 변경 전에 **확장 → 이관 → 축소(expand/migrate/contract)** 3단계로 분할했는가
- [ ] 롤백용 역방향 SQL 을 PR 설명에 첨부했는가
- [ ] `settlements`, `ledger`, `payments` 테이블 변경이면 정산 담당자 승인을 받았는가
- [ ] 대용량 테이블(`orders`, `order_items`)의 인덱스 추가에 `CONCURRENTLY` 를 검토했는가
