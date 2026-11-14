# PR #48 보안 수정 분리

기준 main `a1060a7b`, 2026-11-15 KST. 원본 PR #48 전체를 머지하지 않고 보안 수정만 새 브랜치로 이식한다.

## 포함 범위

- `scripts/test_region.js`: 코드 내 project ref·비밀번호 fallback 제거. import 시 Prisma를 로드하거나 연결하지 않는다. `ALLOW_REGION_PROBE`가 정확히 true이고 ref·비밀번호·명시적 pooler host가 있어야 실행한다. 현재 gate는 미설정/OFF이며 이번 작업에서는 켜지 않는다.
- 호스트는 Supabase pooler 형식만 허용한다. 공식 Connect 화면에서 제공한 단일 주소를 사용하며 지역별 추측 호스트를 순회하지 않는다. 비밀번호는 URL encode하고 TLS를 요구한다. 성공/실패 문구만 출력하며 SDK 오류·URL·비밀번호는 출력하지 않는다. 성공·실패 모두 연결을 정리하고 실패 시 종료 코드는 1이다.
- `.tmp`, `.codex-tmp` 및 frontend의 동일 임시 경로를 ignore한다. 이미 추적된 파일에 소급 적용되거나 git 이력을 정리하는 기능은 아니다. 현재 이 네 경로의 추적 파일은 0개로 확인했다.
- npm `semgrep@0.0.1` devDependency와 해당 root lockfile 항목만 제거했다. 기존 CI의 `pipx install semgrep` 및 `security:scan` 명령은 보존한다. 로컬에서 보안 명령을 실행하려면 공식 Semgrep CLI가 PATH에 필요하다.

## 충돌·lockfile 처리

원본 PR의 `.env.example`, `.gitignore`, lockfile을 통째로 가져오지 않았다. 최신 main의 AI OFF·migration 차단 설정을 유지하며 필요한 ignore 규칙만 추가했다. root `npm install --package-lock-only --ignore-scripts`로 manifest와 lockfile을 함께 정리했고 제거 대상 외의 lockfile 패키지 버전 변경은 없다.

root·frontend 모두 `npm ci --dry-run --ignore-scripts --no-audit --no-fund` 통과. 과거 PR의 frontend lockfile 설치 실패를 새 PR로 가져오지 않았으며 현재 frontend manifest/lockfile은 수정하지 않는다. dry-run은 실제 clean install·빌드의 대체가 아니므로 새 PR CI에서 이를 추가 확인한다.

대규모 TS/MJS 삭제, #50 런타임 wrapper 정책, FoodTruck UI, 스크립트 이동, 문서·그래프 산출물 정리, frontend 패키지 정리는 별도 후속 범위다. 원본 PR #48은 종료하지 않는다.

## 검증 경계

스크립트 보안 테스트는 합성 비밀번호·host와 가짜 Prisma 클라이언트만 사용한다. 기본 OFF·입력 누락·host 주입 차단·특수문자 encode·단일 호출·오류 로그 마스킹·disconnect를 검사한다. 실제 Supabase·운영 Redis·DB에 연결하지 않는다. 비밀 파일이나 실제 환경 파일을 읽거나 수정하지 않는다.

```sh
node scripts/run-jest.cjs --config jest.config.js tests/unit/scripts/regionProbeSecurity.test.js --runInBand --roots tests --coverage=false
npm run ai:review:check
```

공식 참고: [Supabase 연결 문서](https://supabase.com/docs/guides/database/connecting-to-postgres), [변경 이력](https://supabase.com/changelog). 연결 주소는 대시보드에서 확인해야 한다. 이 스크립트는 운영 진단을 자동 실행하는 도구가 아니다.

실행 결과: 보안 스크립트 10건 통과, 전체 백엔드 211개 스위트/1,656건 통과, AI OFF 설정 5건 통과. 테스트 파일 ESLint 오류 0이며 `scripts/test_region.js`는 기존 ESLint 제외 규칙 대상이므로 구문 검사와 실행 테스트로 검증했다. root·frontend 설치 dry-run 모두 통과했다. 실제 Node 22 clean install 및 CI/E2E는 새 PR에서 별도 확인한다.

## 남은 운영 조치

소스에서 비밀을 제거해도 과거 git 이력의 자격증명이 무효화되지는 않는다. 기존 자격증명 교체 완료 여부는 미확인이며 담당자의 별도 확인·승인된 교체가 필요하다. 이번 작업에서 비밀번호 교체·이력 재작성·운영 환경 갱신은 수행하지 않았다. 실제 값은 문서·PR·로그에 기록하지 않는다.

모든 AI 활성화·유료 호출·매장 플래그 OFF, 승인형 migration 기본 차단 및 운영 자동 배포 차단 유지. 운영 배포·DB 변경·유료 API 호출·외부 게시 없음.
