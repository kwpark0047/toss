# Voice Order 2.0 Live 연동 결과

2026-11-14. 기준 PR #85 / 90d5dbba. PR #85 최신 CI 43542331852 및 보안 43542331823 success, E2E success 확인. 조건부 생략 검사는 통과로 세지 않았고 deploy는 skipped이다.

## 구현

- 기존 VoiceOrderAssistant의 SpeechRecognition/직접 입력/공개 parse/초안 확인·장바구니 콜백은 그대로 유지한다. 기본 OFF인 VITE_AI_LIVE_UI_ENABLED가 명시적으로 켜진 경우에만 별도 ‘Live로 주문하기’를 제공한다. 현재 실제 환경 파일과 서버 Live gate는 변경하지 않았다.
- 동의 후 Live 시작 → 실제 서버 get_menu/validate_order_draft → 서버 검증 전체 주문 초안 표시 → 고객 버튼 확인 → 기존 onAddDraft(lines) → 기존 장바구니/결제 흐름이다. 이 기능은 주문·결제 API를 호출하지 않는다. 음성으로 ‘확인’이라고 말하는 것만으로 장바구니/결제를 실행하지 않는다.
- 수정은 확인 전 전체 초안의 교체다. 수량·옵션 수정/삭제를 모델에 요청하되 항상 전체 snapshot을 서버 검증하도록 지시한다. 실제 모델의 한국어 수정 이해 품질은 유료 호출 없이 검증하지 않았다. 이미 장바구니에 담은 항목은 기존 장바구니에서 수정한다.
- 고객 텍스트 수정, 입력 전사, 끼어들기, 도구 재조회, 연결 재개/종료 때 이전 초안을 무효화한다. 수신했던 draft ID의 replay를 무시하고 확인은 세션 내 최신 ID에 1회만 허용한다. 수정 문장을 입력 중이면 늦은 초안이 들어와도 확인을 막는다.
- 서버 검증 중 새 수정 발화가 들어오면 revision을 즉시 올려 늦은 이전 검증 결과를 UI 초안으로 발행하지 않는다. 확인 필요 초안은 명시적으로 표시하되 담기 버튼은 비활성화한다. 공통 P0 취소·매장 격리·예산 검증은 유지한다.
- 확인 시 현재 메뉴의 ID/이름/가격/품절, 1~20 수량, 옵션 존재·활성/중복/필수/최대 개수, 옵션 가격, 단가·행 합계·총액을 전체 대조한다. 한 줄이라도 불일치하면 전체를 거부한다. 이것은 화면 캐시와의 추가 대조이며 최종 서버 재고·가격 검증을 대신하지 않는다.
- Live 실패/기존 방식 전환은 기존 음성 주문 대화상자를 연다. 마이크 권한 거부 후 다른 마이크를 자동 재요청하지 않는다. 고객이 기존 말하기 버튼 또는 직접 입력을 선택한다. 언어 선택은 기존 SpeechRecognition locale을 유지한다.
- 공통 훅은 같은 페이지에서 새 Live를 시작할 때 이전 Live 엔진을 종료한다. Live 상태 이벤트로 팅커벨 MP3/TTS의 중첩 재생을 중지하며 종료·폴백 때 기존 안내 경로로 돌아간다.

## 검증

- 프런트 Vitest 7파일/48개: 초안→고객 확인→기존 콜백, 최신 전체 snapshot 교체, 미확인/수정중/품절/가격·옵션·수량/합계 오류 차단, 초안 replay·전사 무효화, 기존 음성 주문·P1 팅커벨·Toss ready 계약.
- 백엔드 10개 PASS: 전용 임시 Redis + 로컬 HTTP/WSS + fake Provider. 실제 서버 draft 검증, clarification 전달, 검증 중 수정 발화에 따른 stale 결과 폐기, 기존 인증/예산/취소/미디어 회귀. Redis는 메모리 전용 --rm 컨테이너이며 검사 후 종료했다. 기존/운영 DB 접근·변경 없이 수행했다.
- 실패를 먼저 재현한 항목: 수정 후 기존 초안 확인 허용, clarification UI 미발행, 수정 전 검증 결과 지연 발행, 입력 중인 수정 요청보다 늦은 초안 확인 활성화.
- 변경 프런트/백엔드 ESLint 오류 0, 백엔드 typecheck, 프런트 production build. 기존 exhaustive-deps 경고와 번들 크기/wakeup import 경고는 별도로 남아 있다.
- `node scripts/verify-voice-order-live-ui.cjs`: msedge/Playwright 및 frontend 의존성 필요. 격리 로컬 Vite 5182, 가짜 마이크·WSS, 외부 API 차단. 390×844 및 320×640에서 ‘QA 커피 2개 → 1개로 수정 → 고객 확인 → 테스트 장바구니 1개’, 닫기 마이크 track 해제, 503 후 기존 음성/직접 입력 복귀 확인. 가로 넘침 없음. 주문/결제 API 호출 0.
- 화면·기계 판정: reports/ai3-voice-live-20261114/draft-390.png, draft-320.png, cart-390.png, cart-320.png, legacy-fallback-320.png, browser-check.json. 단위/브라우저 fixture 검증이며 실제 Android/iPhone·실제 음성 이해/지연/Google 청구·실제 카드 결제 검증이 아니다.

## 제출과 롤백

별도 feat/voice-order-live-v2 브랜치. P0/P1이 main 미병합이므로 main 대상 PR에는 #84/#85 의존 변경도 포함되며 이번 변경은 별도 커밋으로 구분한다. 운영 머지/배포·Prisma/schema/migration/기존 DB 변경·유료 Live 호출은 제외했다. 결제·환불·정산 서비스는 수정하지 않았다.

롤백: UI flag와 서버 Live gate OFF, 활성 세션 종료, 기존 음성/직접 입력 유지. DB 역마이그레이션 없음. 실제 합성 음성 canary·계정 모델 지원/비용 대사·모바일 실기기 검증은 별도 승인 후 수행한다.
