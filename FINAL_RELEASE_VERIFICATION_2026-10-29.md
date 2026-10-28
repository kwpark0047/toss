# 위마켓 최종 배포 및 출시 검증 보고서

- 작성일: 2026-10-29 (KST)
- 저장소: `kwpark0047/toss`
- 검증 기준 브랜치: `main`
- 검증 성격: 현재 운영 배포본과 소스·DB 마이그레이션 정합성 확인

## 판정 요약

**운영 배포와 배포 소스/DB 마이그레이션 정합성은 확인했습니다.** 다만 이 확인만으로 전체 제품을 `Production Ready` 또는 유료 상용 출시 완료라고 판정하지 않습니다. 이 문서는 배포 일치 상태와 남은 실제 검증 범위를 분리해 기록합니다.

## 배포 식별 및 상태

| 항목 | 확인 결과 |
|---|---|
| GitHub `main` / 출시 기준 SHA | `e19463b981eed3c777d69b1fe9e0783f514cdfb7` |
| 해당 커밋 트리 | `2deb46c5c7e2f137f07fd4ce5ddaecdb98cac380` |
| GitHub 상태 검사 | Vercel check 성공 |
| Render 서비스 | `wemarket` (`srv-db0aoa7avr4c73esalbg`), 상태 `live` |
| Render 배포 | `dep-dbh313rbc2fs73ejs7h0`, 위 SHA에서 배포 완료 |
| Vercel 프로젝트 | `wemarket-saas` (`prj_ZXshlSsA2zPPNuIAhI0FtUwWwMYL`) |
| Vercel production 배포 | `dpl_ATMMPMQgoBuN74qxMa4o6wVyNVLG`, 상태 `READY`, 위 SHA |
| 운영 health | `https://wemarket-saas.vercel.app/api/health` → HTTP 200, JSON `status=ok`, `db=connected`, `revision`이 위 SHA와 일치 |

Render 서비스는 `autoDeploy=no`로 확인했습니다. 따라서 GitHub 반영만으로 Render가 자동 배포되지 않으며, 이 문서 커밋의 Render 적용은 별도 수동 배포가 필요합니다.

## 데이터베이스 정합성

운영 Supabase 프로젝트 참조는 `kdisbvhofkyoijnawszp`입니다.

- 운영 `public._prisma_migrations`: 총 49건, 완료 49건, 미완료 0건
- 최신 완료 시각: `2026-10-28 14:18:55.221215+00`
- 직전 소스 대조에서 배포 소스의 migration SQL 49개와 DB 이력 49개를 비교했습니다. 누락·추가·체크섬 불일치·미완료 항목은 모두 0건이었습니다.
- 이번 문서는 문서 파일만 추가하며 Prisma schema·migration 파일은 변경하지 않습니다.
- 이번 작업에서 운영 DB migration은 실행하지 않았습니다.

## 로컬 검증 기록

출시 기준과 같은 코드 트리에서 직전 확인한 결과:

- `npx prisma validate`: 통과
- `npx prisma generate`: 통과
- StoreService Jest: 25/25 통과
- 관리자 런타임 테스트: 3/3 통과
- 전체 역할별 실계정 브라우저 E2E, Toss 운영 결제/환불, 백업/PITR 복구훈련은 이번 검증에서 실행하지 않았습니다.

## 출시 커밋 CI 검증

PR #39의 첫 CI 실행에서 린트, 스키마, 단위/통합 테스트, 프론트 테스트·빌드, PostgreSQL 금융 회귀, 브라우저 smoke 및 보안 검사는 통과했습니다. Playwright E2E job은 테스트 실행 전에 브라우저 설치에서 실패했습니다. GitHub `ubuntu-latest`가 Ubuntu 26.04를 선택했지만 Playwright 1.58.2가 해당 OS를 지원하지 않는다는 오류였습니다. 테스트를 건너뛰거나 실패를 성공으로 바꾸지 않았습니다.

재발 방지를 위해 E2E job만 `ubuntu-24.04`로 고정했습니다. 이 수정이 포함된 후속 CI의 E2E 재실행 결과는 GitHub PR 상태에서 별도로 확인해야 합니다. 첫 실패는 환경 호환성 실패이며 E2E 통과 증거로 계산하지 않습니다.

## 미완료 출시 게이트

다음은 완료로 간주하지 않습니다.

1. 사업자·직원·매니저·주방·고객·최고관리자 역할별 격리 staging 브라우저 E2E
2. Toss 계약 및 운영 MID 확인 후 실제 결제·환불·웹훅·원장 대사 검증
3. 실제 업체 원장 자료를 이용한 POS/배달/PG 정산 대사
4. Supabase 백업 또는 PITR 시점 확인과 격리 대상 복원·복구 절차 훈련
5. staging의 장애·재시도·부하·세션 폐기 및 개인정보 보존 흐름 검증

따라서 현재 증거가 뒷받침하는 상태는 **“현재 main 배포 일치 및 운영 health 확인”**입니다. 유료 상용 전체 흐름의 완료나 운영 복구 가능성을 보증하지 않습니다.

## 작업 트리와 변경 범위

- 후보 worktree `codex/db-migration-alignment-20261029`의 코드 트리는 기준 배포 커밋의 트리와 동일했습니다.
- 기본 로컬 checkout은 `codex/live-sha-sync`의 과거 커밋을 가리키고, 변경 불가한 `.git/index.lock` 권한 오류로 포인터 갱신이 막혔습니다. 이를 덮어쓰거나 reset하지 않았습니다.
- 기본 checkout에 존재하는 기존 미추적 보고서·테스트 자료는 이번 배포에 포함하지 않습니다.
- 이번 출시 변경은 최종 검증 보고서와 Playwright E2E runner 호환성 수정으로 제한합니다.

## 배포 후 완료 조건

1. GitHub main의 새 보고서 커밋 및 필수 검사가 성공한다.
2. Vercel production이 새 main SHA로 `READY`가 되고 공개 도메인이 새 revision을 제공한다.
3. Render 수동 배포가 `live`가 되고 health revision이 같은 SHA를 반환한다.
4. health JSON의 `db=connected`와 migration 이력 49/49 상태가 유지된다.
5. 위 조건 확인 뒤에도 미완료 출시 게이트는 별도로 관리한다.
