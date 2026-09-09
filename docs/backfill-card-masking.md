# 카드번호 마스킹 백필 가이드

이 문서는 `scripts/mask_card_numbers.js` 백필 스크립트의 사용법과 주의사항을 정리한다.

---

## 1. 개요

이 스크립트는 운영 DB의 과거 `payments.card_number` 레코드를 일괄 마스킹한다.

- **대상 테이블**: `payments`
- **대상 필드**: `card_number`
- **마스킹 정책**: 앞 6자리 + 뒤 4자리 유지 (예: `123456******3456`)
- **실행 모드**: Dry-Run(기본) / Apply(`--apply` 옵션)

---

## 2. 사전 준비

### 2.1 환경 변수 확인

```bash
# .env 파일에 DATABASE_URL 설정 확인
DATABASE_URL=postgresql://user:password@host:port/dbname
```

### 2.2 백업 확인

백필 실행 전 운영 DB를 백업한다.

```bash
# Supabase Dashboard → Database → Backups에서 수동 백업 생성
# 또는 pg_dump로 로컬 백업
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## 3. 실행 방법

### 3.1 Dry-Run (변경 없이 확인)

```bash
# 영향 받을 레코드 수 확인
npm run backfill:mask-card-numbers

# 예상 출력:
# [Backfill] 기존 payments.card_number 마스킹 시작 (DRY-RUN)
# 마스킹 후보 레코드: 123개
# [Backfill] 완료 { mode: 'DRY-RUN', wouldUpdate: 123, ... }
```

### 3.2 실제 적용 (Dry-Run 후)

```bash
# --apply 옵션으로 실제 변경
npm run backfill:mask-card-numbers -- --apply

# --limit 옵션으로 처리 건수 제한
npm run backfill:mask-card-numbers -- --apply --limit=50
```

### 3.3 운영 환경 적용

운영 환경에서는 이중 확인이 필요하다.

```bash
NODE_ENV=production npm run backfill:mask-card-numbers -- --apply --yes
```

---

## 4. 마스킹 정책

| 상태 | 형식 | 예시 |
|------|------|------|
| 마스킹 전 (정상) | 앞6 + 중간 * + 뒤4 | `123456******3456` |
| 마스킹 전 (레거시) | `****-****-****-XXXX` | `****-****-****-3456` |
| 이미 마스킹됨 | 위 두 가지 형식은 스킵 | - |

---

## 5. 검증

백필 후 검증 쿼리:

```sql
-- 마스킹된 레코드 수 확인
SELECT COUNT(*) as masked_count
FROM payments
WHERE card_number ~ '^\d{6}\*{6}\d{4}$';

-- 마스킹되지 않은 레코드 확인 (이상 없으면 0이어야 함)
SELECT COUNT(*) as unmasked_count
FROM payments
WHERE card_number IS NOT NULL
  AND card_number !~ '^\*{4}-\*{4}-\*{4}-'
  AND card_number !~ '^\d{6}\*{6}\d{4}$';
```

---

## 6. 롤백

백필을 되돌리려면 백업 파일을 사용한다.

```bash
# 백업 파일에서 card_number 복원 (주의: 다른 변경사항도 롤백됨)
psql $DATABASE_URL < backup_20260909_120000.sql
```

---

## 7. 문제 해결

| 문제 | 해결 방법 |
|------|-----------|
| `DATABASE_URL 미설정` 오류 | `.env` 파일 확인 또는 환경 변수 설정 |
| `운영 환경에서는 --yes 필요` 오류 | `--apply --yes` 옵션 모두 사용 |
| `잘못된 --limit 값` 오류 | 양의 정수 사용 (예: `--limit=100`) |
| 연결 시간 초과 | DB 연결 상태 확인, 네트워크 문제 점검 |

---

## 8. 관련 파일

- `scripts/mask_card_numbers.js` - 백필 스크립트
- `utils/cardMask.js` - 마스킹 유틸리티 (공유 모듈)
- `services/PaymentService.js` - 서비스 레이어 마스킹 로직
- `prisma/schema.prisma` - payments 모델 정의 (L168)
