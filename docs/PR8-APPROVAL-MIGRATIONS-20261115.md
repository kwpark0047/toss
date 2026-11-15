# PR #8 최신 main 통합 및 승인 환경 검증

기준 main `f8c9e52b`, 2026-11-15 KST. 운영 배포·실제 DB 변경·migration workflow 실행은 이번 작업에서 제외한다.

## 변경

- Render Blueprint 빌드는 `--apply` 대신 `--check`로 pending migration을 검사한다. 실제 Render 대시보드 설정은 변경하지 않는다. `--check`는 DB 읽기 연결이 필요하므로 이번에는 실행하지 않고 순수 계산·설정 테스트만 수행한다.
- `DB Migrate (approval required)`는 수동 실행만 지원한다. `ENABLE_APPROVED_DB_MIGRATIONS`가 정확히 `true`일 때만 사전 검증하며 미설정/false는 실패로 중단한다. 이번 작업에서는 이 변수를 만들거나 켜지 않는다.
- 독립 preflight job은 환경 바인딩 전에 main ref·대상 whitelist·GitHub API의 실제 환경명·필수 승인자·자기 승인 금지·관리자 우회 금지를 검증한다. 환경이 없거나 권한 부족(403)/404/네트워크 실패/불완전 응답이면 차단한다. 환경 생성·보호 설정·secret 쓰기 기능은 없다.
- preflight 성공 후에만 대상 환경에 연결되는 migrate job으로 넘어간다. 실제 승인은 GitHub Environment가 수행하며 preflight는 승인을 대신하지 않는다. 플랫폼 승인 뒤 보호 상태를 재검사하고 의존성을 설치한다. DB URL은 migration 명령 단계에만 제공한다.
- GITHUB_TOKEN에 `contents: read`, `actions: read`만 요청한다. 계정/요금제/권한에 따라 environment GET을읽지 못하면 차단을 유지한다. 쓰기 권한·PAT을 자동 발급하지 않는다.
- Node 버전은 기존 `.nvmrc`와 package engines를 유지한다. 기존 npm ci/CI의 Prisma 생성과 중복되는 pretest는 제거한다. backend unit/route 검사는 단일 Jest 실행으로 묶는다.

## 실제 환경 준비 상태

사전 읽기 점검에서 소문자 `staging`·`production` 보호 환경과 required reviewers가 확인되지 않았다. 기존 `Production` 등 환경을 승인 보호가 있는 환경으로 간주하지 않는다. 현재 상태는 **미준비·기본 차단**이며 문서/코드 머지가 DB 실행 권한을 의미하지 않는다.

향후 별도 승인된 담당자가 정확한 이름의 환경·필수 승인자·자기 승인 금지·관리자 우회 금지·환경별 migration secret을 준비하고 읽기 권한을 검증한 뒤에만 명시적 opt-in을 검토한다. 승인되지 않은 환경 생성·운영 설정 변경·DB 접근을 이번 PR에 포함하지 않는다.

## 검증 범위

가짜 GitHub 응답으로 정상 보호 환경과 환경 누락·대소문자 불일치·승인자 누락·빈 목록·자기 승인·관리자 우회·OFF gate·비 main·잘못된 대상·빈 token·403/404/500·네트워크/응답 오류를 검사한다. workflow 의존 관계·실행 순서·DB secret 범위와 pending migration 계산도 검사한다.

`pendingMigrations`는 로컬 migration 디렉터리와 journal 이름의 차이를 계산한다. 체크섬 손상·실패 journal 행·DB 스키마 drift 전체를 보증하는 검사는 아니다. DB 상태의 최종 대조는 별도 허용된 작업에서 수행해야 한다. migration SQL·Prisma schema·실제 환경 파일은 수정하지 않는다.

```sh
node scripts/run-jest.cjs --config jest.config.js tests/unit/scripts/migrationApproval.test.js tests/unit/scripts/migrationDeployment.test.js --runInBand --roots tests --coverage=false
npm run ai:review:check
```

최신 PR CI·E2E 통과 후에만 머지한다. 모든 AI 활성화·유료 호출 플래그와 운영 배포 차단은 유지한다.
