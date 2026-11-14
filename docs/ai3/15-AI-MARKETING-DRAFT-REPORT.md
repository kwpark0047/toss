# AI 마케팅 — 사업자 검토용 초안

## 구현 범위

- 스마트 마케팅의 **AI 마케팅 초안** 진입점. 기존 캠페인 데이터 조회가 실패해도 초안 화면에 진입할 수 있다.
- 판매 중인 매장 메뉴 1~5개 선택, 인스타그램·네이버 소식·매장 홍보 문구, 친근한/정중한 말투.
- 기본 템플릿 초안은 외부 API 없이 동작한다. Gemini 생성은 `AI_MARKETING_ENABLED=true`, `AI_MARKETING_ALLOW_PAID=true`, 모델·키 설정 및 요청별 전송 동의가 모두 필요하다. 기본 설정은 OFF다.
- 서버가 매장별 운영 권한을 검증하고 해당 매장 메뉴만 읽는다. 요청의 고객정보·임의 매장명·임의 가격은 모델 입력에 포함하지 않는다.
- AI 출력은 길이가 제한된 일반 텍스트와 해시태그만 허용한다. 가격·할인·기간·알레르기·효능 등의 추측 금지 지시를 적용하지만 AI 사실성을 보증하지 않으므로 사업자 대조가 필수다.
- 초안 편집 및 검토 체크 후 로컬 클립보드 복사. 문구·해시태그·선택 조건 변경 시 검토 승인이 해제된다. 매장 이동 시 초안·동의·승인을 폐기한다.
- 외부 게시·SMS·캠페인 저장·DB 쓰기 API를 호출하지 않는다. 고객용 음성/결제 흐름은 변경하지 않는다.
- AI 호출 20초 제한, 출력 1,024토큰 제한, IP당 분당 10회 요청 제한. 운영 다중 인스턴스 비용 통제 확장이 필요하면 별도 공용 제한 정책을 적용해야 한다.

## PR #89 확인 및 보완

- 기존 head `10ec39ae`의 CI 실패 원인은 `tests/unit/routeMounting.test.js`의 고아 라우트 검사였다. `routes/ai.js`에서 사용하는 하위 라우터를 직접 app.mts에 등록하지 않았다는 이유로 잘못 판정했다.
- 보완 커밋 `95ed0ed4f97dd286d7b6735299cb625789b1d1cc`: app.mts에서 도달 가능한 하위 require 의존성을 검사하도록 수정했다. 예외 파일 allowlist로 검사를 우회하지 않았다.
- 최신 CI [43583923566](https://github.com/kwpark0047/toss/actions/runs/43583923566) SUCCESS, 보안 [43583923594](https://github.com/kwpark0047/toss/actions/runs/43583923594) SUCCESS. PR #89는 미병합 상태다.

## 검증 (2026-11-14)

- `npm test -- --runInBand --roots tests --silent`: 백엔드 205 suites / 1,608 tests PASS, coverage gate 통과. roots 옵션은 로컬 임시 checkout의 중복 탐색을 제외한다.
- `node --test tests/saas/marketing-drafts.test.cjs`: 4 PASS. 기본 외부 호출 없음, 이중 게이트, 전송 동의, 입력 allowlist, 매장 권한·잘못된 메뉴·상충 ID 차단.
- 프론트엔드 마케팅 및 메뉴 사진 회귀 선택 6 files / 8 tests PASS. 실제 CampaignDashboard와 ProductModal 연동을 포함한다.
- `npm run typecheck:backend`, 프론트엔드 `npm run typecheck`, `npm run build` PASS.
- 변경 프론트엔드 및 백엔드 파일 ESLint PASS. 전체 프론트엔드 lint는 기존 `Step1InlineGuide.jsx:94`의 `react-hooks/refs` 오류 1건 및 기존 경고로 실패한다. 기존 파일은 이 PR에서 수정하지 않는다.
- 프론트엔드 전체 `npm test`: 93 files / 399 tests PASS (360초). jsdom의 기존 `window.scrollTo` 미구현 안내가 있으나 실패는 없다.
- `node scripts/verify-marketing-draft-ui.cjs`: 390px/320px 로컬 Edge 모바일 에뮬레이션 PASS. 검토 전 복사 차단, 검토 후 복사, 편집 후 승인 해제, AI 동의 요구, 503 안내, 가로 넘침 없음. 외부 네트워크 요청 0. API/AI는 합성 fixture로 대체했다.
- 로컬 화면 증거: `reports/ai3-marketing-20261114/draft-390.png`, `review-edit-390.png`, `disabled-ai-320.png`, `browser-check.json`. 실제 휴대폰 검증이나 실제 Gemini 호출 결과가 아니다.

## 제외 및 의존성

외부 게시·운영 배포·DB 변경·유료 API 호출은 수행하지 않았다. 브랜치는 미병합 PR #84~#89의 누적 작업을 기반으로 하므로 main 대상 PR에는 해당 선행 변경도 포함된다. 이번 단계의 변경은 `95ed0ed4..HEAD`로 검토할 수 있다. 병합·배포는 이 요청 범위에 포함되지 않는다.
