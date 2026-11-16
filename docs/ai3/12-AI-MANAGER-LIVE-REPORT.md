# AI Manager 2.0 Live 연동 결과

2026-11-14. 기준 PR #86 / 90634b59. 최신 CI 43544818992와 보안 43544818971 success, E2E success 확인. 조건부 생략 검사는 통과로 세지 않았으며 운영 deploy는 skipped다.

## 구현 범위

- 기존 AIStoreManager에 기본 OFF(VITE_AI_LIVE_UI_ENABLED)의 Live 상담을 연결했다. 현재 라우트 매장 ID와 실제 브리핑의 store.id가 일치할 때만 진입점을 표시하고 매장 변경 시 컴포넌트를 재생성해 기존 마이크/소켓을 정리한다. 실제 환경 파일/운영 설정은 변경하지 않았다.
- 음성·텍스트 질문, 자막·서버 근거 집계, 동의·음소거·종료·기존 텍스트 상담 폴백을 제공한다. 세션 발급은 항상 purpose=manager이며 기존 API client의 인증을 사용한다. UI의 can_execute는 안내용이며 서버 권한 판단을 대체하지 않는다.
- Live 도구는 기존 get_store_summary와 신규 get_manager_briefing/get_manager_actions의 읽기 전용 허용 목록이다. 고객 도구와 분리하고 임의 storeId 인자를 받지 않는다. 서버에 귀속된 매장 ID만 사용하며 도구 실행 전과 결과 전달 직전에 현재 세션/계정/매장 역할을 재검증한다.
- ManagerLiveReadService는 기존 StoreManagerService.collect 및 actions만 재사용한다. briefing/chat/evaluate는 스냅샷/제안/평가를 저장하므로 Live 경로에서 호출하지 않는다. 새 도구가 별도 스냅샷이나 제안을 생성하지 않는다.
- 조회 결과는 필요한 자체 주문 순매출/주문 수/동일 요일 완료시간 비교/리뷰 집계/기존 제안 제목·상태만 투영한다. 고객 연락처, 원문 리뷰, 직원 ID/승인자·실행자, 외부 계정 정보 등을 Provider나 브라우저 사실 카드에 전달하지 않는다. 매장 불일치 집계는 거부하고 다른 매장 제안 행은 제외한다.
- Provider 지침은 승인된 제안도 자동 실행 권한이 아니며 임의 기간·인과관계를 추측하지 않도록 명시한다. 실제 실행/승인/중단 도구는 등록하지 않는다.

## 기존 사업자 승인 절차

Live의 ‘기존 제안·승인 화면 보기’는 상담을 종료하고 기존 카드로 이동할 뿐이다. 기존 routes/storeManager.js, StoreManagerService.transition 및 기존 승인/실행 버튼 로직은 변경하지 않았다.

기존 흐름은 소유주 제안 승인 → approved → 미리보기·최종 확인 → execute이다. 관리자는 조회 가능하지만 변경 버튼이 없으며, 서버도 소유주만 transition을 허용한다. super_admin 조회 권한을 소유주 실행 권한으로 확대하지 않는다. Live에서 ‘실행해’라는 발화나 approved 상태를 읽는 것만으로 변경 API가 실행되지 않는다.

## 검증 결과

- 프런트 9파일/53개 PASS: Live 동의/manager scope/기존 텍스트 폴백/제안 화면 이동, 실제 AIStoreManager의 소유주 approve→execute와 최종 확인 취소 차단, 관리자 변경 버튼 숨김, Voice Order/P0/P1/Toss ready 회귀.
- 백엔드 총 18개 PASS(17개 묶음 + 추가 매장 불일치 1개): P0 정책·PCM·도구·Redis HTTP/WSS, 기존 매니저 분석/권한 라우터, 새 투영/도구 테스트. 실제 로컬 WSS로 관리자 세션 시작 후 읽기 도중 권한을 취소해 private managerFacts가 전달되지 않는 것을 확인했다.
- 변경 프런트·백엔드 ESLint 오류 0, backend typecheck, frontend production build PASS. 기존 번들 크기 및 wakeup import 경고는 별도로 남아 있다.
- `node scripts/verify-ai-manager-live-ui.cjs`: msedge/Playwright 및 frontend 의존성 필요. 전용 로컬 Vite 5183과 가짜 마이크/WSS/집계/transition API를 사용하고 외부 네트워크는 차단한다. 테스트 프로세스에만 UI flag를 설정한다.
- 390px 소유주 화면: Live 질문(실행 요청 포함) 후 mutation 0, 기존 카드로 이동 후에도 0, 고객이 승인 버튼을 눌렀을 때만 approve, 최종 확인 취소 시 execute 없음, 명시 확인 후에만 fake execute 기록.
- 320px 관리자 화면: 소유주 변경 버튼 없음, 발급 403 시 기존 텍스트 상담 안내, 가로 넘침 없음. 변경 요청은 전부 fake API였으며 실제 DB 상태/추천 노출은 바뀌지 않았다.
- 증거: reports/ai3-manager-live-20261114/browser-check.json, owner-live-facts-390.png, owner-approved-fixture-390.png, manager-denied-fallback-320.png. 실제 휴대폰 또는 유료 Live 품질/청구 검증이 아니다. 첫 브라우저 로딩 timeout 후 domcontentloaded/초기 로딩 시간을 조정해 재실행 통과했다.

## 경계와 남은 검증

현재 연결 범위는 기존 데이터의 조회·상담과 승인 화면 연계다. 임의 주간·월간 신규 분석, 재고/예약/원문 리뷰 도구, 새 캠페인 초안 자동 저장, 7개 전문 에이전트 전체 구현을 의미하지 않는다. 실제 계정 모델/한국어 음질·지연/실기기/요금 대사는 별도 승인 canary가 필요하다.

feat/ai-manager-live-v2는 #86 위의 별도 개발 브랜치다. main에 P0/P1/Voice Order가 미병합이므로 main 대상 PR diff에는 이 의존 변경도 포함되며 Manager 기능은 별도 커밋으로 구분한다.

운영 머지/배포, 실제 환경변수·기존 DB·Prisma/schema/migration 변경, 유료 Live 호출은 수행하지 않았다. 검증용 임시 Redis는 종료했다. 롤백은 UI/서버 Live gate OFF 및 활성 연결 정리이며 기존 텍스트 상담/소유주 승인 절차와 원장은 유지한다. DB 역마이그레이션은 필요 없다.
