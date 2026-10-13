# 외부 데이터 공통 기반 운영 활성화

## 적용한 범위

- 운영 DB: `20261008020000_canonical_sync` 하나만 targeted script로 적용.
  6개 신규 테이블·RLS 확인, 체크섬 재확인 통과. 기존 주문/결제와 다른 pending migration 변경 없음.
- GitHub main: 기능 commit `331db3832ee9b42b4b466e1caacc2046a07b8aa4`.
  수정 범위 15개 파일. 다른 로컬 P0/신뢰성 변경을 함께 공개하지 않았다.
- CI 테스트 로더 수정: `b0c4443084ca7757983637697bdde2a2cfcd23d9`.
  VM require가 scripts 디렉터리를 기준으로 새 service dependency를 찾던 문제를
  createRequire(service path)로 수정. 실제 PostgreSQL에서 재현 후 승인/동시성/AI 제한 검증 통과.
- Vercel 운영: `dpl_6EJi6Aoo6TiMKR3vLSnRiyfjryev`, READY.
  URL https://wemarket-saas.vercel.app, 원격 production build 성공.
  실제 통합센터 JS `assets/StoreIntegrationCenter-BvLHVJSU.js` HTTP 200,
  신규 검증 상태 화면과 syncHistory 호출 포함 확인.
- 배포할 main 복제본의 SaaS 회귀 58개 통과.

## 코드와 운영 검증의 구분

Render https://wemarket.onrender.com/api/health HTTP 200, db connected 확인.
이 health에는 commit SHA가 없으므로 이 응답만으로 신규 backend commit 반영을 증명하지 않는다.
현재 Render API 인증 연결 없음, 브라우저 제어 초기화 오류로 dashboard 확인 불가.
운영의 인증된 sync-history 응답·배포 commit·로그 확인은 남아 있다.
원격 CI backend-unit/regression/frontend/security/browser smoke는 로더 수정 후 모두 성공.
CI deploy job은 success이지만 Render deploy hook과 Vercel secrets가 없어 플랫폼 배포 명령을 실제로 건너뛰었다.
Vercel은 별도 인증된 CLI 배포를 완료했으며, Render 신규 backend commit 배포 확인은 남아 있다.
실제 런타임 DATABASE_URL로 신규 테이블 읽기 확인,
provider 계정과 sync 작업은 모두 0개.

실제 provider 계정/adapter 미등록. OAuth, 자동 수집 worker, reconciliation, mapping queue,
AI 매출 합산은 활성화하지 않았다. 빈 데이터나 키 등록을 업체 연동 성공으로 표시하지 않는다.
업체명과 공식 API 문서 확보 후 실제 reference 연결 검증이 필요하다.

## 복구

Vercel 직전 정상 deployment로 rollback 가능. GitHub 기능 이전 main은
`7d0c93fd69454bf46755038bb1e8a1180ffdb476`.
DB는 additive이므로 앱만 이전 버전으로 복구하고 새 테이블/수집 근거는 유지한다.
신규 테이블 삭제나 migration 기록 제거는 복구 절차로 자동 실행하지 않는다.

## 사용자 제공 hook 직접 실행

- 2026-10-08 사용자가 제공한 기존 서비스 deploy hook에 POST 실행.
- HTTP 200, 배포 ID `dep-db3glfui0phs73a3rdng` 접수 확인.
- 이후 운영 health HTTP 200, DB connected, uptime 30초 확인.
- hook URL/인증 키는 보고서나 공개 코드에 기록하지 않았다.
- Render 관리 API 인증이 없어 해당 배포의 최종 상태와 commit SHA는 관리 화면 검증이 필요하다.
- GitHub CLI 인증은 여전히 없어 Actions secret 저장은 이번 직접 실행과 별개로 미완료이다.

## 2026-10-09 GitHub 인증 및 Secret 등록 완료

- GitHub CLI `kwpark0047` 인증 완료.
- `RENDER_DEPLOY_HOOK_URL` Actions Secret 등록 및 목록 확인 완료. 비밀값은 기록하지 않음.
- 원격 main `b0c4443084ca7757983637697bdde2a2cfcd23d9` 확인.
- CI run 37703026987 attempt 2 success, deploy job 113435244679 success.
- Render hook 실행 생략 없음, 접수된 배포 ID `dep-db3soiom7kps73fu1360` 확인.
- CI Vercel 배포는 별도 Vercel secrets 미등록으로 생략; 앞선 직접 운영 배포와 구분.
- Render 관리 API의 최종 deploy 상태/commit 조회 권한은 별도로 확보하지 않음.

