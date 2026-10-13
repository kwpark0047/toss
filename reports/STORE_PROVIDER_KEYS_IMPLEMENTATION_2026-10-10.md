# 사업장별 API 키 설정 구현

상태: 로컬 구현 및 아래 검증 완료. 미커밋·미배포. 운영 DB 미적용.
기준 RC `a30e355aad426808215a4a26b73ee87e5f0fea8f` 이후 변경이며, 기존 RC의 검증을 새 변경의 검증으로 대체하지 않는다.

## 변경

- 매장 환경설정(StoreSettings)에 기존 보안 인증정보 패널을 연결했다. 데이터 통합 화면에서도 동일 설정을 사용한다.
- 범용 POS/테이블오더/온라인 주문 설정을 유지하면서 토스플레이스·페이히어·OKPOS·이지포스·요기요·쿠팡이츠·토스페이먼츠 거래 대사 키를 개별 공급자로 추가했다. 배민 표기를 구체화했다.
- 기존 AES-256-GCM 저장 및 매장/공급자 AAD 바인딩을 재사용한다. 응답은 마스킹만 제공하고 폼은 password 입력을 사용한다. 빈 입력은 기존 값 유지, 교체·비활성화·삭제를 지원한다.
- 기존 route의 매장 소유주/최고관리자 제한 및 no-store 응답을 유지했다. URL 매장 범위로 저장하며, body의 store_id 등 미허용 필드는 기존 service validation으로 거부한다.
- 매장 변경 시 패널/카드를 다른 key로 마운트하여 입력 중인 인증정보가 다음 매장에 남지 않도록 했다. 공급자 catalog 조회는 Object.hasOwn으로 prototype 이름을 공급자로 인식하지 않도록 했다.
- 토스페이먼츠 등록 키는 거래 대사 용도이다. 기존 주문 결제·SaaS 청구 키를 바꾸지 않으며, 다른 매장/글로벌 키로 fallback하지 않는다.
- 서울/기상청은 기존 최고관리자 공통 설정을 유지한다. 신규 업체들의 adapter=false와 adapter_required 상태를 유지하며 키 보관을 자동 수집/실제 연결 성공으로 표시하지 않는다.

## DB

`prisma/migrations/20261010010000_store_provider_catalog/migration.sql`은 기존 provider_credentials CHECK 목록을 확장한다. 테이블/암호화 형식/API 경로를 변경하지 않는다. 전역 scope는 기존 naver/seoul/weather만 허용한다.

로컬 전용 `wemarket_test_staging_20261010`에서 deploy-migrations 실행 exit 0. 운영 적용 전 마이그레이션 검토/백업 확인 및 별도 운영 DB 적용 승인이 필요하다. 운영 DB가 새 목록을 허용하기 전에는 신규 업체 저장 코드만 먼저 운영 배포하지 않는다.

## 검증 증거

|검증|실행|결과|
|---|---|---|
|신규 업체 재현|node --test tests/saas/provider-credentials.test.cjs|수정 전 5 pass/1 fail: 신규 업체가 지원되지 않음|
|서비스 회귀|동일 명령|수정 후 6 pass/0 fail/0 skip|
|실제 PostgreSQL|P0_TEST_DATABASE_URL을 신규 localhost 테스트 DB로 지정하고 node --test tests/database/store-provider-credentials-postgres.test.cjs|1 pass/0 fail/0 skip. 7개 업체의 store 분리·마스킹·비활성화·교체 및 scope CHECK 23514 확인. transaction rollback|
|권한 API|node scripts/run-jest.cjs --config jest.config.js tests/unit/routes/providerCredentials.authorization.test.js --runInBand --json --outputFile=reports/store-provider-authorization-20261010.json|6 pass/0 fail. HTTP route 실제 호출, 인증/권한 조회/service는 통제된 mock|
|UI|npm --prefix frontend test -- src/components/admin/ProviderCredentialPanel.test.jsx --maxWorkers=1|2 pass/0 fail. 마스킹·password 입력·매장 저장 URL·입력 초기화·비활성화|
|빌드|npm --prefix frontend run build|exit 0, PWA 생성. 400kB 초과 chunk 경고 남음|
|정적 검사|eslint 서비스 및 git diff --check|서비스 eslint error 없음, diff check 성공. 루트 eslint가 frontend를 ignore하므로 frontend lint 통과로 주장하지 않음|

테스트/빌드 최초 실행은 자동 승인 검토의 사용량 한도로 실행되지 않았다. 사용자 재개 후 정상 실행됐다. 안전하지 않다는 판단으로 거부된 경우는 아니다.

## 수정 파일

services/ProviderCredentialService.js; frontend/src/components/admin/ProviderCredentialPanel.jsx; StoreSettings.jsx; StoreIntegrationCenter.jsx; 신규 migration; tests/saas/provider-credentials.test.cjs; tests/database/store-provider-credentials-postgres.test.cjs; tests/unit/routes/providerCredentials.authorization.test.js; frontend/src/components/admin/ProviderCredentialPanel.test.jsx.

## 미검증/운영 조건

실제 업체 인증 권한·공식 adapter·실제 원본 대사·hosted staging 브라우저·운영 DB/배포는 미검증이다. 공개 API가 확인되지 않은 업체는 제휴/승인된 계정과 계약 확인 후 연결한다. 운영 PROVIDER_SECRET_KEY의 안정적 보관·backup/복구를 확인해야 한다. 이번 구현은 기존 암호화 key fallback 정책을 변경하지 않았다.
