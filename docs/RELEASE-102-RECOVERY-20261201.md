# PR #102: 12월 1일 릴리스·복구 절차

준비일: 2026-11-18. 실행 예정: 2026-12-01 09:00 Asia/Seoul 이후.
이 문서의 릴리스 절차는 실행 계획이며 운영 적용·운영 복구 훈련 완료 기록이 아니다. 별도로 수행한 수동 백업·로컬 SQL 복원 검증 결과는 아래에 구분한다.
사용자는 원격 검증 통과 후 #102 추가 마이그레이션·배포·운영 확인을 승인했다.
11월에는 Actions를 재개하거나 운영 DB·배포 설정을 변경하지 않는다.

## 변경과 고정 경계

- 대상: `20261117010000_barogo_reservation_snapshot`.
- SQL: `ALTER TABLE public.orders ADD COLUMN delivery_reservation jsonb;`
- 기준 파일 SHA-256: `d432084c39dfc19233c112fdceb49ceb6ac96a4259194e06761ca141dd5c10ff`.
- nullable JSONB 열 한 개 추가. 기존 데이터 삭제·보정, 다른 마이그레이션 일괄 적용 금지.
- 바로고·부릉·생각대로 `ready:false`, 매장 `agency_auto_dispatch=false` 유지.
- 고객 예약 주문 기본 차단(409) 유지. 실배차·업체 API·유료 AI·주문/결제 생성 금지.
- 코드 기준은 검증한 main SHA. #102 머지 `d4aa7dcb75109c7c49f2b3a22b35df3b2ccee3ee` 포함 여부 확인.

## 실행 전 기록

- [ ] 기존 예약 `12-actions`로 기존 7개 Actions만 재개. CI `job=required` 및 Security Scanning 성공 URL·SHA 기록. 실패/사용량 제한이면 운영 변경 중단.
- [ ] 배포 직전 main SHA가 검증 SHA와 동일한지 확인. 다르면 재검증 없이 배포하지 않는다.
- [ ] 현재 Render/Vercel 정상 배포 ID·SHA·URL을 각각 기록한다. 두 플랫폼의 복구 권한과 이전 산출물 접근 가능 여부 확인.
- [ ] 직전 정상 버전의 헬스·화면 및 배차 비활성 상태를 기록한다. 과거 정상 SHA `543d2b4f`는 참고값이며 당일 실측값을 우선한다.
- [ ] Supabase 대상 `kdisbvhofkyoijnawszp` 확인. 백업/PITR 사용 가능 여부·최근 복구 시점·복구 담당자 확인. 서비스 전체 복원은 이 릴리스의 자동 복구 수단으로 사용하지 않는다.
- [ ] 운영 게이트 원래 값 기록. 검증 중 `ENABLE_PRODUCTION_DEPLOY`, `ENABLE_APPROVED_DB_MIGRATIONS`는 OFF. 비밀 연결 문자열·토큰은 로그/문서에 남기지 않는다.

## 수동 백업·격리 복원 검증 결과

2026-11-19 03:03 KST 기준. 사용자 승인으로 유료 전환 없이 수행했다.
운영 DB에는 읽기 전용으로 접속하고, REPEATABLE READ 트랜잭션의 export snapshot을 pg_dump와 공유하여 한 시점의 전체 custom archive 및 비교용 테이블 행 수를 기록했다.
운영 스키마·데이터·배차 설정은 변경하지 않았다.

| 검증 항목 | 결과 |
| --- | --- |
| 수동 백업 생성 | 성공. 로컬 접근 제한 경로에 보관, 무결성 해시 별도 기록 |
| 격리 복원 | 성공, pg_restore 종료 코드 0 |
| SQL 복원 검증 범위 | public / auth / storage |
| 테이블·행 수 대조 | 167개 테이블·201,190행, 스냅샷 기록과 전부 일치 |
| 미검증 제약조건 / invalid 인덱스 | 각각 0개 |
| 실패 migration 이력 / 자동 배차 활성 매장 | 각각 0개 |
| 추가 migration 로컬 시험 | nullable JSONB·기본값 없음 확인 후 트랜잭션 rollback |
| 검증 환경 정리 | 격리 PostgreSQL 서버 정상 종료 |

로컬 복원은 loopback 전용 별도 클러스터와 임의 비밀번호 인증을 사용했다. 백업 보관 디렉터리 ACL은 해당 Windows 사용자와 SYSTEM으로 제한했다.
백업 파일·원본 manifest·접속정보·전체 로그·상세 보관 경로·백업 해시는 이 문서와 PR에 싣지 않는다. 백업과 검증 기록은 Git 제외 경로에 남긴다.

### 남은 한계와 릴리스 조건

- 운영 PostgreSQL 17 백업을 로컬 18.6에 복원했다. 동일 메이저·동일 Supabase 환경 복원 검증은 아니다.
- 전체 DB archive 생성과 실제 복원 검증 범위는 구분한다. Supabase 관리 확장(vault 등), 플랫폼 메타데이터 전체 및 외부 Auth 서비스 동작은 검증하지 않았다.
- Storage SQL 메타데이터와 실제 저장 객체 파일은 다르다. 객체 파일 복구는 검증하지 않았다.
- 로컬 복원은 `--no-owner --no-acl`을 사용했다. 원본 소유권·ACL·역할 비밀번호의 복구는 검증하지 않았다. 데이터 내용별 해시 비교·실제 서비스 기동 검증도 하지 않았다.
- 단일 로컬 디스크 사본이며 별도 원격/오프사이트 사본과 PITR을 대체하지 않는다. 데이터 손실 없는 운영 전체 복구를 입증하지 않는다.
- 대시보드에서 확인한 현재 Free 플랜에는 관리형 정기 백업이 제공되지 않으며 PITR도 활성화되어 있지 않다. 요금제·유료 옵션은 변경하지 않았다.

12월 1일에는 배포 직전 새 시점의 수동 백업을 별도 경로에 생성하고 무결성·격리 SQL 복원 검증을 다시 수행한다. 기존 백업을 덮어쓰지 않는다.
최신성·검증 결과·안전한 보관·담당자 접근을 확인한 대체 백업이 있으면, 관리형 백업 부재만으로 승인된 nullable 열 추가 릴리스를 중단하지 않는다.
백업/필수 복원 검증이 실패하거나 이번 검증 범위를 넘어서는 변경이 필요하면 DB 적용·배포를 중단하고 보고한다. 유료 전환·운영 전체 복원·외부 백업 업로드는 별도 범위다.

12월 1일 예약에는 이 결과 요약, 검증 범위와 당일 갱신·재검증 조건을 반영했다. Actions 중지·운영 배차 비활성 경계는 유지한다.

## DB 상태 분류와 적용

읽기 전용으로 다음을 확인한다. 출력에는 주문 내용이나 고객 정보를 포함하지 않는다.

```sql
SELECT migration_name, checksum, started_at, finished_at, rolled_back_at, applied_steps_count
FROM public._prisma_migrations
WHERE migration_name = '20261117010000_barogo_reservation_snapshot'
ORDER BY started_at;

SELECT data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'orders'
  AND column_name = 'delivery_reservation';

SELECT count(*) AS auto_dispatch_enabled
FROM public.store_order_channels WHERE agency_auto_dispatch = true;
```

| 관측 상태 | 조치 |
| --- | --- |
| 열 없음, 성공 이력 없음 | 승인 SQL만 실행하고 실제 열을 확인한 뒤 해당 migration만 applied로 기록 |
| 올바른 열 있음, 성공 이력·체크섬 일치 | 재실행 생략 |
| 올바른 열 있음, 성공 이력 없음 | SQL 완료 여부와 실패 이력을 확인. 열을 다시 추가하지 말고 해당 migration만 resolve |
| 성공 이력 있음, 열 없음 / 타입·nullable·기본값 불일치 / 체크섬 불일치 | 불일치로 중단. 이력 위조·임의 열 수정 금지, 원인 보고 |
| 다른 pending/failed migration 존재 | 대상 외 SQL 적용 금지. 배포 read-only check를 막으면 원인·추가 승인 필요 범위 보고 |

연결은 승인된 보안 경로로 주입한 `MIGRATION_DATABASE_URL`을 사용한다.
운영 URL을 명령 인자·셸 이력에 넣지 않는다. 같은 연결을 Prisma의 DATABASE_URL/DIRECT_URL에도 안전하게 설정한다.
SQL 실행은 트랜잭션과 세션별 lock_timeout 5초·statement_timeout 30초를 설정한 DB 클라이언트로 수행한다.
잠금 시간초과 시 강제 세션 종료나 반복 재시도 없이 ROLLBACK하고 기존 서비스 상태를 확인한다.
SQL 성공을 확인한 경우에만 `npx prisma migrate resolve --applied 20261117010000_barogo_reservation_snapshot`를 실행한다.
실패 이력이 있으면 Prisma의 실제 resolve 제약을 확인하고, 실행되지 않은 SQL을 applied로 기록하지 않는다.
`_prisma_migrations` 직접 UPDATE/DELETE는 하지 않는다.

**현재 DB Migrate 워크플로와 `scripts/deploy-migrations.cjs --apply`는 모든 pending을 적용하므로 이번 단일 적용에 사용하지 않는다.**
마지막에 `node scripts/deploy-migrations.cjs --check`로 배포 게이트를 읽기 검증한다.
열은 있어도 이력 기록에 실패했다면 배포하지 않고 상태를 보존한 채 이력 복구부터 완료한다.

## 배포와 실패 시 복구

정상 경로: DB 확인 → 검증 SHA의 승인된 단일 배포 → Render/Vercel 완료 대기 → 운영 확인.
기존 CI `job=deploy`는 필수 잡을 다시 수행하므로 비용을 기록하며 중복 수동 실행하지 않는다.
Render hook은 기존 workflow처럼 검증 SHA를 명시한다. latest를 임의 배포하지 않는다.
일시적으로 켠 게이트는 성공·실패 모두 finally 단계에서 원래 OFF 값으로 복구한다.

| 실패 지점 | 복구 절차와 완료 조건 |
| --- | --- |
| SQL 실패/잠금 시간초과 | 트랜잭션 rollback, 열·이력 재조회. 구버전 서비스 유지. 실패한 SQL을 applied 처리하지 않음 |
| SQL 성공, 이력 기록 실패 | 새 열 보존, 새 앱 배포 중단. 실제 스키마 검증 후 해당 이력만 복구 |
| Render 빌드/기동 실패 | 실제 트래픽이 구버전인지 먼저 확인. 필요하면 기록한 직전 정상 Render 배포로 rollback. 헬스/DB 연결과 revision 확인 |
| Render 성공, Vercel 실패 또는 그 반대 | 혼합 버전 지속을 피하도록 바뀐 플랫폼을 각각 기록한 정상 배포로 복구. Vercel은 정상 immutable 배포를 production으로 복원하고 도메인 확인 |
| 양쪽 배포 성공, 운영 검사 실패 | 추가 배포 중단, 비밀/개인정보 없는 로그 수집. 직전 정상 두 플랫폼으로 복원하고 동일 운영 검사를 재실행 |
| 정상 배포 산출물 없음/rollback 실패 | 완료 처리 금지. 장애 범위·현재 SHA·복구 제약 보고. 확인되지 않은 SHA나 main 최신 빌드로 대체하지 않음 |

앱 복구 시 **새 nullable 열은 남겨 둔다**. 구버전과의 호환성을 유지하며 자동 DROP COLUMN 또는 DB 전체 시점 복원을 하지 않는다.
기록한 정상 버전을 새로 빌드해야 하는 경우 현재 migration check가 배포를 막는지 먼저 확인한다. 게이트 우회 대신 기존 정상 산출물 복원을 우선한다.
PITR/백업 복원은 신규 주문·결제 손실 위험이 있으므로 별도 영향 분석·명시 승인 없이는 실행하지 않는다.
실패한 릴리스를 되돌려도 배차 기능은 켜지 않는다.

## 운영 확인 체크리스트

운영 API: https://wemarket-eiw4.onrender.com / 프런트: https://wemarket-saas.vercel.app
대상 설정은 `config/deployment-targets.json`과 일치해야 한다.

- [ ] Render 서비스 `srv-db0aoa7avr4c73esalbg`, Vercel 프로젝트 `prj_ZXshlSsA2zPPNuIAhI0FtUwWwMYL` 정상 완료 및 production 트래픽 연결.
- [ ] `/api/health`: 200, DB connected, revision=검증 SHA. `/api/health/deep`: schema/operationalConfig 정상.
- [ ] 프런트 HTML `app-commit`과 백엔드 revision 모두 검증 SHA. 새 세션으로 실제 화면을 열어 자산 로딩·브라우저 오류 확인. PWA가 있으면 업데이트 후 다시 확인.
- [ ] `/api/stores/search?limit=1`, 키워드 검색, 실제 반환 매장의 order-channels·상품·공개 법정 정보 읽기 성공. 주소 비공개 정보 노출 없음.
- [ ] 익명 admin 주문유형 설정·매장 주문 목록 요청은 401/403. 인증 우회 금지.
- [ ] 승인된 기존 운영 계정이 있는 경우 주문 목록/상세를 읽기만 하여 새 JSON 열로 인한 조회 오류 없음. 계정 없으면 미검증으로 보고.
- [ ] 새 열은 jsonb/nullable/default 없음, 성공 이력·체크섬 일치, 다른 pending 없음.
- [ ] 코드의 세 대행사 ready:false 및 생성자 기본 예약 차단 확인. 실제 주문 생성으로 409를 시험하지 말고 검증 SHA의 회귀 테스트를 근거로 구분해 기록.
- [ ] DB `agency_auto_dispatch=true` 매장 수 0. 다른 값이면 임의 일괄 수정 없이 릴리스 중단·보고.
- [ ] 세 대행사 webhook이 비활성인지는 읽기 가능한 설정/로그를 우선 확인. 기존 검증기의 빈 POST 검사는 반드시 비활성 레지스트리 선차단을 코드로 확인한 경우만 수행. 실배차/실제 이벤트를 보내지 않음.
- [ ] 새 5xx·스키마 오류·배차/결제 부작용 없음. 관측 시각·기간·데이터 출처 기록, 관측 범위를 넘어 무장애라고 단정하지 않음.
- [ ] 모든 임시 게이트 원상복구, 자동 배차 OFF 유지. CI/보안·migration·양쪽 deploy ID/SHA·운영 검사 결과·누락 항목을 각각 보고.

## 실행 기록 양식

| 항목 | 당일 기록 |
| --- | --- |
| 검증 main SHA / CI·보안 run URL | 미실행 |
| 직전 Render/Vercel 배포 ID·SHA | 당일 실측 필요 |
| DB 사전 상태 / SQL 결과 / 이력·체크섬 | 미실행 |
| 새 Render/Vercel 배포 ID·SHA | 미실행 |
| 운영 검사 시각·결과·未검증 항목 | 미실행 |
| 실패 원인 / 복구 배포 ID·SHA / 복구 검사 | 해당 시 기록 |
| 게이트 복구 / 배차 비활성 확인 | 미실행 |
