# P1 팅커벨 Live 연동 — 구현·검증 보고서

2026-11-14 / 기준: PR #84의 c95255d6. PR #84 최신 CI 43539544761의 실행된 테스트(마지막 E2E 포함) 및 보안 검사는 통과했다. 조건부 생략 job과 운영 배포 성공을 의미하지 않는다.

## 사용자 흐름

- 메뉴 화면 팅커벨에 별도 ‘음성 대화’ 진입점을 추가했다. 캐릭터·날개·정적/reduced-motion 폴백·기존 MP3/TTS 자산을 보존한다. SPEAKING 상태는 기존 캐릭터 반응과 연결한다.
- 명시적 동의 + ‘대화 시작’ 후에만 P0 발급/마이크/WSS 흐름을 실행한다. 연결·듣기·응답·도구 조회·중단 상태와 입출력 자막, 500자 텍스트 입력, 음소거/해제, 닫기/Escape를 제공한다.
- Live 패널에서는 기존 음성을 일시 중지하고, 서버 비활성/권한·예산·네트워크·마이크 오류 시 기존 안내 음성으로 폴백한다. 기존 음성 주문 버튼과 결제 흐름은 그대로다. 관리 화면/미리보기에는 고객 Live 진입점을 노출하지 않는다.
- 기존 9개 언어(ko/en/ja/zh/tl/vi/id/th/ms)의 캐릭터 대사를 유지하고 Live UI 문구도 제공한다. 실제 모델별 다국어 음성 품질은 검증하지 않았다.
- liveStoreId는 추천 동의용 storeId와 분리한다. Live 진입을 위해 aiRecommendation을 자동 활성화하지 않는다.

## 설정과 권한

`VITE_AI_LIVE_UI_ENABLED=false`가 기본이다. root/frontend .env.example에만 추가했으며 실제 환경 파일/운영 설정은 변경하지 않았다. UI flag만 켜도 P0 서버 전역·유료·매장별 gate와 예산/Origin/권한 검증을 통과해야 연결된다. 이번에는 gate를 활성화하지 않았다.

영구 키/일회 ticket을 UI나 브라우저 저장소에 추가하지 않는다. P1은 원본 음성/전사를 영속 저장하지 않고 세션 중 자막만 메모리에 최대 2,000자씩 유지한다. Google의 데이터 처리 정책 자체를 대신 보장하지 않는다.

음소거는 마이크 track을 비활성화하고 PCM 송신 및 출력 재생을 중지한다. 닫기·unmount·pagehide는 P0 엔진의 소켓/트랙/오디오 자원을 정리한다. 중단 후 늦게 도착한 이벤트를 폐기한다. 자막 분할 조각이 덮어써지던 동작은 실패 테스트 재현 후 순서대로 누적하도록 수정했다.

## 검증

- Vitest 6파일/38개 PASS: P1 동의·기본 OFF·관리자 미노출·9언어·텍스트·자막·음소거·종료, P0 client/audio/hook, 기존 VoiceOrderAssistant·날씨 안내·Toss ready 계약.
- 변경 프런트 파일 ESLint 오류 0. 기존 exhaustive-deps 경고 3개는 남아 있다. 기존 렌더링 중 ref 갱신 오류는 effect로 옮겨 해소했다.
- 프런트 production build 검증. 기존 chunk 크기/wakeup import 경고와 실제 유료 동작 검증은 구분한다.
- 브라우저 재현: 저장소 루트에서 `node scripts/verify-tinkerbell-live-ui.cjs`. frontend 의존성 및 Playwright/msedge 설치 필요. 전용 로컬 Vite(5181), 격리 context, 외부 네트워크 차단, 가짜 발급·WebSocket·마이크/AudioContext를 사용한다. 실제 고객/카드/DB/Google Live를 사용하지 않는다.
- 390×844 및 320×640에서 가로 넘침 없음, 1280×900 데스크톱 화면 확인. 큰 글씨·명시 동의·503 폴백·자막·음소거 track 비활성화·닫기 track stop 확인. 증거: reports/ai3-p1-tinkerbell-20261114/browser-check.json 및 PNG.
- 이 결과는 모바일 viewport 브라우저 검증이며 실제 Android/iPhone·실제 음질·지연·끼어들기·Google 청구 대사 성공이 아니다.

## 범위·다음 단계·롤백

P0 개발 브랜치 위에 별도 P1 브랜치를 만들었다. P0가 main에 미병합이므로 main 대상 PR에는 P0 의존 변경도 포함된다. P1 변경은 별도 커밋으로 구분한다. 운영 머지/배포·DB schema/data 변경·유료 Live 호출은 하지 않는다.

이번 단계는 고객 Live 대화 UI 연결이다. Live 추천 상품을 별도의 구조화 카드로 노출/클릭하는 확장, 검증 초안의 장바구니 반영은 후속 Voice Order 단계이며 이 패널은 주문/결제 API를 실행하지 않는다. 모델의 텍스트만으로 주문·가격·결제 성공을 확정하지 않는다. 기존 추천 UI/클릭 콜백은 보존한다.

실제 Live/staging canary 및 실기기 검증은 별도 승인 후 수행한다. 장애 시 UI flag와 서버 Live gate를 OFF하고 기존 일반 모드를 유지한다. DB 역마이그레이션이 필요하지 않으며 P0 예약·감사 원장은 보존한다.
