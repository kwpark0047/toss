# 역할별 staging E2E 실행 런북

출시 게이트 1번(사업자·매니저·직원·주방·고객·최고관리자 역할별 격리 E2E)을 실행하는 절차다.
스펙: `tests/e2e-roles/roles.spec.js`, 설정: `playwright.roles.config.js`.

## 0. 사전 준비 (사용자가 직접 해야 하는 인프라)

| 항목 | 내용 |
|---|---|
| staging DB | 운영(Supabase `kdisbvhofkyoijnawszp`)과 분리된 Supabase 프로젝트 또는 브랜치. 운영 데이터 복제 금지, 시드만 사용 |
| staging API | Render에 운영과 별도 서비스(예: `wemarket-staging`), `DATABASE_URL`/`DIRECT_URL`은 staging DB, `TOSS_*`는 **테스트 키** |
| staging 프론트 | Vercel Preview 또는 별도 프로젝트. `/api/*` 가 staging API로 프록시되어야 함 |
| 계정 | 역할별 1개씩 시드 계정(2FA 비활성). `scripts/seed_gangnam_test_owners.js` 또는 수동 생성 |
| 매장 | 위 owner 소유 매장 1개, manager/staff/kitchen 이 소속, 테이블 1개 이상, 메뉴 1개 이상 |

## 1. 환경 변수

```bash
E2E_BASE_URL=https://<staging-frontend-host>
E2E_STORE_ID=<staging 매장 id>
E2E_MENU_PATH=/menu/<storeId>?table=<tableId>
E2E_OWNER_ID=...        E2E_OWNER_PASSWORD=...
E2E_MANAGER_ID=...      E2E_MANAGER_PASSWORD=...
E2E_STAFF_ID=...        E2E_STAFF_PASSWORD=...
E2E_KITCHEN_ID=...      E2E_KITCHEN_PASSWORD=...
E2E_CUSTOMER_ID=...     E2E_CUSTOMER_PASSWORD=...
E2E_SUPERADMIN_ID=...   E2E_SUPERADMIN_PASSWORD=...
E2E_ALLOW_WRITES=false  # true 일 때만 KDS 상태 변경 같은 쓰기 시나리오 실행
```

- 값은 셸 또는 CI secret 으로만 주입한다. 파일로 저장할 경우 `.env.e2e.local` (gitignore 대상 `.env*`) 사용.
- `E2E_BASE_URL` 이 운영 호스트(`wemarket-saas.vercel.app`, `wemarket-eiw4.onrender.com`, `wemarket.onrender.com`)이면 스펙이 즉시 실패하도록 막혀 있다.

## 2. 실행

```bash
npx playwright test -c playwright.roles.config.js
npx playwright show-report playwright-report/roles
```

## 3. 검증 범위

| 역할 | 로그인 | API 권한(허용/거부) | 관리 화면 |
|---|---|---|---|
| owner | ✔ | KDS·정산·직원 허용, 플랫폼 거부 | dashboard, menu, orders, tables, staff, settings, settlements, stats |
| manager | ✔ | KDS·직원 허용, 플랫폼 거부 | dashboard, menu, orders, staff, stats |
| staff | ✔ | KDS 허용, 정산·플랫폼 거부 | orders, tables |
| kitchen | ✔ | KDS 허용, 정산·직원·플랫폼 거부 | kitchen |
| customer | ✔ | KDS·정산·직원·플랫폼 거부 | 고객 메뉴판(모바일 포함) |
| superadmin | ✔ | 전체 허용 | /admin, supervisor, system-status, plan-requests |

권한 기대값은 `middleware/storeAuth.js` 권한표 기준이다. 실패 시 스펙 기대값이 아니라 실제 권한 정책이 맞는지 먼저 확인하고, 정책 변경이면 `API_MATRIX` 를 함께 갱신한다.

## 4. 판정 기준

- 모든 역할 테스트가 skip 없이 통과해야 출시 게이트 1번을 완료로 기록한다. skip 이 있으면 그 역할은 미검증이다.
- 쓰기 시나리오는 `E2E_ALLOW_WRITES=true` 로 1회 이상 통과해야 한다.
- 결과(리포트 경로, 커밋 SHA, staging 배포 SHA)를 `docs/verification/` 에 남긴다.
