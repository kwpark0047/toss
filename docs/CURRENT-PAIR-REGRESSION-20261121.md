# 후속 배포 이후 운영 조합 회귀 확인

후속 확인: 실제 앱·합성 DB·Chromium 서비스 워커를 연결한 제한된 로컬 장바구니/PWA E2E를 완료했다. [격리 E2E 결과와 한계](LOCAL-CART-PWA-E2E-20261121.md)를 함께 읽는다. 아래 최초 로컬 회귀·운영 읽기 전용 기록과 구분한다.

확인일: 2026-11-21 KST. 원격 Actions 실행·운영 설정 수정·추가 배포 없이 로컬 테스트와 운영 GET/읽기 전용 SQL로 확인했다.
백업 파일·원본 로그·접속정보·비공개 백업 경로·백업 해시는 이 문서와 PR에 포함하지 않는다.

## 현재 버전과 기존 기록의 관계

| 대상 | 현재 운영 SHA | 배포 맥락 |
| --- | --- | --- |
| 백엔드 | `975ab5d863652b54189079c000c32d513f78b23f` | PR #102 추가 migration 및 PR #107 포함 릴리스 |
| 프런트 | `014c3a938e943efecc152494bf279e3d8a3f3589` | 후속 PR #108: 활성 장바구니 보존·다음 QR 진입 시 PWA 갱신 |

[최초 릴리스 결과](RELEASE-102-RESULT-20261121.md)의 양쪽 SHA 일치와 13개 운영 검사 성공은 당시 기록으로 유효하다. 현재는 후속 프런트 배포로 SHA가 다르며, 동일 버전이라고 보고하지 않는다.
두 운영 커밋 사이 변경은 프런트 PWA·장바구니·관련 테스트/빌드 설정이다. `services/routes/repositories/src/prisma/config`와 프런트 REST API 클라이언트에는 차이가 없음을 Git 비교로 확인했다.
이는 호환성 판단의 근거이지, 모든 실제 사용자 시나리오의 성공을 보장하지 않는다.

## 로컬 회귀 검증

로컬 Node v24.11.1, 기존 설치 의존성을 사용했다. 운영 데이터 접속 변수를 테스트에 주입하지 않았다.
프런트는 실제 운영 커밋 `014c3a93`을 체크아웃하여 실행했다. 백엔드 테스트 대상 소스는 위 비교로 운영 `975ab5d8`과 동일함을 확인했다.

| 범위 | 결과 | 검사 내용 |
| --- | --- | --- |
| 프런트 Vitest | 6개 파일·28개 테스트 통과 | 안전한 PWA 갱신 시점, 메뉴 세션/장바구니 상태, service worker 갱신, 공유 장바구니 |
| 백엔드 Jest | 3개 스위트·81개 테스트 통과 | StoreService, 주문유형 처리, 바로고 옵션·예약 경계 |

프런트 파일: `customerAutoUpdate.test.jsx`, `menuCartSession.test.js`, `menuCartState.test.jsx`, `menuUpgradeWorker.test.js`, `useSharedTableCart.test.js`, `sharedCartConnection.test.jsx`.
백엔드 파일: `StoreService.test.js`, `OrderService.orderType.test.js`, `BarogoOptionsReservations.test.js`.

공유 장바구니 연결 검사는 임의 loopback 포트의 실제 Socket.IO 테스트 서버를 사용한다. 운영 서버 전체를 기동한 결합 E2E는 아니다. PWA 갱신 테스트는 모의 service worker 환경으로, 실제 모바일 기기의 offline/재접속 검증을 대체하지 않는다.
백엔드 Jest는 로컬 임시 디렉터리의 중복 package 이름 경고가 있었으나 81개 테스트는 모두 통과했다. 관련 없는 임시 파일은 수정하지 않았다.

## 운영 읽기 전용 검사

| 확인 범위 | 결과 |
| --- | --- |
| 백엔드 health | HTTP 200, DB connected, SHA `975ab5d8` |
| deep health | schema 및 operationalConfig 정상 |
| 매장 목록·키워드 검색 | HTTP 200 |
| 기존 매장 주문유형·상품·공개 법정 정보 | 각각 HTTP 200 |
| 익명 관리자 설정·매장 주문 조회 | 각각 HTTP 401 |
| 프런트 HTML | HTTP 200, app-commit `014c3a93` |
| 운영 DB 읽기 | 대상 migration 성공 이력 1개, 자동 배차 활성 매장 0개 |

위 11개 검사 항목이 모두 통과했다. 주문·결제·장바구니 변경·webhook POST·업체 API 호출·운영 계정 로그인을 수행하지 않았다.
운영 migration을 재실행하거나 신규 백업을 만들지 않았다. 이전 복원 검증은 역사적 근거이며 이번 조합 테스트로 갱신됐다고 표현하지 않는다.
Actions 7개는 모두 `disabled_manually`, `ENABLE_PRODUCTION_DEPLOY=false`를 확인했다. 운영 배차와 유료 기능은 활성화하지 않았다.

## 남은 미검증 항목

- 인증된 운영 주문 목록·상세 조회 및 사용자 권한별 화면 검증.
- 장바구니/PWA의 한정된 실제 앱 결합 E2E는 후속 격리 검사에서 완료했다. 최초 연결 단위 테스트의 로컬 fixture 결과와 혼동하지 않는다. 운영 환경 전체 결합·실기기 검증은 여전히 미수행이다.
- 실제 모바일/PWA 기존 캐시·활성 장바구니·offline·재접속·다음 QR 진입 시나리오.
- 실제 주문 생성·예약 409 차단·결제·배차 및 대행사 API. 운영 부작용 방지를 위해 미실행이다.
- 전체 테스트 스위트·새 production build·실기기 종합 QA·부하/장기 안정성. 이번 로컬 검사는 관련 회귀 범위에 한정한다.
- Supabase 관리 확장·플랫폼 메타데이터 전체·외부 Auth·Storage 실제 객체 파일·원본 소유권/ACL·역할 비밀번호 복구.
- 오프사이트 백업·PITR·운영 전체 복원/rollback 훈련. 기존 단일 로컬 백업의 범위를 넘어 검증한 것으로 해석하지 않는다.

현 시점의 제한된 회귀 범위에서 실패는 발견하지 않았다. SHA 차이만으로 장애 또는 전면 호환을 단정하지 않으며, 후속 검증은 위 미검증 범위를 구분하여 진행해야 한다.
