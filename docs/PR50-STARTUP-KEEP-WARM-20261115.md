# PR #50: 모듈 공유와 keep-warm 분리

2026-11-15 KST. 기준 main `9ef2b94b`. 최신 main을 기존 PR 브랜치에 통합하고 런타임 모듈 공유와 운영 ping을 독립 검증·커밋으로 분리한다.

## Prisma·Sentry

`config/prisma.ts`와 `utils/sentry.ts`는 정본 JS의 얇은 wrapper다. JS 파일 기준 `createRequire`로 tsx의 TS 재해석을 피하고 같은 정본 상태를 사용한다. Prisma 읽기/쓰기 라우팅·query fingerprint·replica 설정, Sentry PII 마스킹·버퍼·샘플링 로직은 JS 정본을 재사용한다.

실제 `node --import tsx` 하위 프로세스에서 JS 먼저/TS 먼저 × replica 없음/있음 4조합을 검증했다. Prisma 생성은 replica 없을 때 1개, 별도 replica URL이 있을 때 의도된 2개이며 TS import로 추가되지 않는다. Sentry는 DSN이 없을 때 SDK 로드 0회, 가짜 DSN과 주입 SDK로 양쪽 init을 호출해도 로드·초기화 각 1회다. 가짜 Prisma·Sentry만 사용하고 소켓 connect를 차단했으며 실제 DB/telemetry 전송은 없다.

이 결과는 모듈 공유·지연 로딩의 증거다. 과거 PR의 로컬 부팅 수치를 현재 운영 성능으로 재사용하지 않는다. 실제 Render cold-start 시간·운영 부하 개선은 이번 범위에서 측정하지 않았다. 대규모 TS 파일 삭제도 포함하지 않는다.

## keep-warm — 기본 OFF

- 독립 `.github/workflows/keep-warm.yml`과 `scripts/keep-warm.cjs`로 분리한다. 예약·수동 실행 모두 `ENABLE_RENDER_KEEP_WARM == 'true'`와 main ref가 필요하다. 변수 미설정/false/대문자 TRUE는 OFF다. 스크립트에도 동일한 gate가 있어 workflow 외 직접 실행도 기본적으로 요청하지 않는다.
- 현재 저장소 변수 `ENABLE_RENDER_KEEP_WARM`은 미설정이다. 만들거나 활성화하지 않는다. 운영 배포·migration·AI gate와 연동하지 않는다.
- 향후 별도 승인해 켜면 고정된 운영 `/api/health/live`에 GET 1회, 최대 30초, redirect 금지로 실행한다. 이 경로는 DB 조회를 하지 않으므로 DB pool 예열을 보장하지 않는다. 응답 오류·네트워크 오류는 job 실패로 처리하고 자동 재시도하지 않는다.
- 예약은 KST 07:00~23:59의 10분 간격이나 GitHub 스케줄은 보장된 타이머가 아니다. 켜면 운영 인스턴스 가동 시간과 Actions 사용량이 늘 수 있다. 요금제·예산 검토와 별도 운영 승인이 필요하다.
- 이번 작업에서는 워크플로를 실행하거나 운영 health URL을 호출하지 않았다. fake fetch로 OFF/잘못된 ref에서는 요청 0회, 명시적 허용 시 정확한 URL 1회, 오류 시 실패를 검증했다.

## 검증

```sh
node scripts/run-jest.cjs --config jest.config.js tests/unit/scripts/keepWarm.test.js tests/unit/config/startup-module-sharing.test.js tests/unit/config/prisma-reliability.test.js tests/unit/utils/sentry.test.js --runInBand --roots tests --coverage=false
npm run ai:review:check
npx tsc --noEmit
```

위 기능 테스트 35건, AI OFF 5건과 타입 검사 통과. 전체 백엔드 213개 스위트/1,667건 통과. 최신 CI·E2E는 별도 확인 후 머지한다. 기존 음성 폴백·권한·승인·공용 예산은 변경하지 않는다. 운영 배포·DB 변경·유료 API 호출·실제 keep-warm 실행은 제외한다. 모든 실제 AI 활성화·유료 호출·매장 플래그와 운영 배포 차단을 유지한다.
