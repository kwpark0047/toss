# Actions 사용량 절감 및 12월 재개

2026-11-18 기준. 사용자 지시에 따라 11월 Actions를 일시 중지하고 2026-12-01 09:00 Asia/Seoul에 한 번 재개하도록 Codex 예약 `12-actions`를 등록했다.

## 현재 운영 상태

아래 워크플로는 모두 원래 active였으며 disabled_manually로 일시 중지했다. 중지 확인 시 실행 중·대기 중인 작업은 없었다. 운영 애플리케이션·배차·DB 설정은 변경하지 않았다.

| ID | 워크플로 | 경로 |
| --- | --- | --- |
| 350175962 | CI | .github/workflows/ci.yml |
| 418486927 | DB Migrate (approval required) | .github/workflows/db-migrate.yml |
| 419128283 | Keep Render API warm (opt-in) | .github/workflows/keep-warm.yml |
| 350175964 | Playwright E2E Tests | .github/workflows/playwright.yml |
| 350175966 | Security Scanning | .github/workflows/security.yml |
| 420549658 | Store search privacy PostgreSQL | .github/workflows/store-search-privacy-postgres.yml |
| 350175968 | Integration Tests | .github/workflows/test.yml |

Store search privacy 워크플로는 별도 브랜치에서 등록되어 있으며 이번 브랜치에서 소스를 수정하지 않았다. PR #102의 CI 실행 43945444520은 이미 success이므로 재실행 대상이 아니다.

## 최적화 변경

- CI의 push/PR에 paths 필터를 적용해 문서·보고서·Markdown·라이선스만 바뀌면 전체 애플리케이션 검사를 시작하지 않는다. 코드·스키마·의존성·워크플로·설정 변경은 계속 검사한다.
- 텍스트 변경의 비밀키 검사는 유지한다. 이미지·폰트·동영상만 바뀌면 별도 Security workflow를 시작하지 않는다. Semgrep·npm audit은 자동 CI의 기존 보안 잡이 수행하며, 별도 Security workflow의 중복 전체 검사는 수동 실행에서만 수행한다.
- 주간 전체 검사는 CI 한 곳으로 모으고 별도 Integration/Playwright의 중복 주간·push/PR 트리거를 제거한다. 독립 실행이 필요하면 수동 실행할 수 있다.
- 같은 단위 테스트를 lint 잡과 backend-unit 잡에서 두 번 수행하던 것을 한 번으로 합친다. coverage 임계값과 실제 PostgreSQL·통합·E2E·배포 게이트는 유지한다.
- Jest 변환 캐시는 OS·Node 22·잡·의존성/설정 해시로 구분하고 커밋별로 저장한다. 원본 변경에 대한 Jest의 자체 캐시 검증을 사용하며 node_modules는 캐시하지 않는다.
- Playwright 브라우저 바이너리를 OS 이미지·아키텍처·lockfile별로 캐시한다. 시스템 라이브러리는 매번 준비하고 브라우저 다운로드만 정확한 캐시 적중 시 생략한다.
- 프런트는 브라우저 스모크 잡에서 한 번 빌드·검증한 뒤 같은 SHA의 산출물을 E2E·번들 검사·Lighthouse가 재사용한다. 일반 CI의 호스트 프런트 빌드는 2회→1회, 선택형 전체 검사는 4회→1회가 된다. Docker 내부 빌드는 별도다.
- npm의 기존 다운로드 캐시를 유지하고 프런트와 백엔드를 함께 설치하는 E2E에는 두 lockfile을 모두 키에 반영한다. Docker 캐시도 backend/frontend scope를 분리한다.
- 수동 기본값은 required이다. Docker·Trivy·Lighthouse·번들·프린트 잡은 all 또는 해당 항목을 선택한 경우만 실행한다. 운영 배포는 기존 opt-in과 main 조건에 더해 수동 선택 deploy를 요구한다.

실제 절감 분·캐시 적중률은 12월 원격 실행 후 비교해야 한다. 11월에는 최적화를 검증하려고 Actions를 다시 켜거나 실행하지 않는다.

## 12월 1일 재개 절차

1. 최신 PR·워크플로 상태를 확인하고 위 7개만 원래 active로 복구한다. 새로 등록된 다른 워크플로를 임의로 활성화하지 않는다.
2. 최적화 PR이 머지됐으면 main, 미머지면 `chore/actions-budget-20261118`에서 CI를 job=required로 한 번 실행한다. 선택값이 아직 없으면 임의로 all을 실행하지 않는다.
3. 별도 Security workflow도 한 번 검증한다. PR #102처럼 이미 성공한 실행은 반복하지 않는다. 사용량 제한이 계속되면 반복 실행하지 않고 보고한다.
4. ENABLE_PRODUCTION_DEPLOY와 ENABLE_APPROVED_DB_MIGRATIONS 등 운영 opt-in이 꺼져 있는지 확인한다. 이 예약으로 운영 배포·DB 적용·유료 기능·배차를 켜지 않는다.
5. 결과와 절감 효과를 보고한다. 이 예약은 PR 머지나 운영 배포를 승인하지 않는다.

워크플로 파일 최적화는 PR 머지 전까지 기본 브랜치의 자동 실행에 반영되지 않는다. 미머지 상태라면 검증 결과를 확인한 뒤 별도 검토가 필요하다. paths로 건너뛴 워크플로가 branch protection의 필수 검사인 경우 pending으로 남을 수 있으므로, 필요한 PR에는 required 수동 검사를 실행한다. 검사를 가짜 성공으로 대체하지 않는다.

## 로컬 검증

- `node --test tests/saas/actions-budget.test.cjs tests/saas/production-deploy-workflow.test.cjs`
- 공식 SHA-256 검증 후 actionlint 1.7.12 실행: 전체 workflow 구문·표현식 검사. 로컬 shellcheck/pyflakes 실행은 제외.
- YAML 파싱, 경로 필터, 단일 coverage 실행, SHA 고정 산출물, 캐시 키·시스템 의존성 설치, 무거운 잡 선택 및 배포 게이트 보존을 검사한다.

원격 Actions 결과는 12월 재개 후 확인한다. 캐시 적중에 따른 실제 실행 시간은 이번 로컬 검증으로 확정하지 않는다.
