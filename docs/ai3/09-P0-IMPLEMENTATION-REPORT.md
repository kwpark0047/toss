# Gemini Live P0 구현 보고서

2026-11-14. PR #83 CI `43477957538`는 success 확인. 본 변경은 감사 문서를 기반으로 한 P0 구현이며 운영 머지·배포·SQL 스키마/데이터 변경·유료 Live 호출을 제외했다.

## 구현 범위

| 영역 | 구현 |
|---|---|
| Provider | `@google/genai` 3.3.0 고정, 기존 `@google/generative-ai` 보존. 영구 키는 서버에만 유지. 모델별 허용 목록, 기본 OFF·유료 연결 별도 gate |
| HTTP/WSS | POST `/api/ai/live/session`, WSS `/api/ai/live/connect`. 30초 일회 ticket, 첫 프레임 인증, 허용 Origin, 발급 rate limit, 매장·목적·동의·멱등 키 검증 |
| 고객/관리자 분리 | 활성 매장·서버 store policy 검증. 관리자 JWT/세션과 현재 매장 역할 재검증. WSS 연결 및 도구 실행 시 세션·권한 재검증. 고객은 메뉴/초안만, 관리자는 본인 매장의 집계 조회만 |
| 비용 | Redis Lua 원자 예약, 월 누적 추정/예약·일일 최대 예약시간·동시성·한 세션 시간·유휴 제한, 서버 Provider 사용량 모달리티별 추정, 미설정 요금·알 수 없는 사용량 차단 |
| 중복·취소 | 세션 발급 멱등, ticket 한 번 소비, 도구 call ID/인자 fingerprint·직렬 실행·취소 검사, 동일 초안 재전달·재확인 차단 |
| 도구 | DB 판매 가능 메뉴 조회, 기존 `resolveVoiceDraft`를 순수 모듈로 추출해 HTTP와 Live에서 공유, 서버 가격/옵션/수량 재검증. 주문·결제·환불 실행 도구 없음 |
| 감사 | Redis 세션 상태/정산 결과와 도구 이름·인자 hash·상태 저장. 원문 음성·전사·API 키·ticket은 감사 로그에 저장하지 않음 |
| 연결 수명 | GoAway/재개 핸들, 최대 두 번 backoff+jitter 재연결, 오래된 Provider 이벤트 폐기, 탭/소켓/서버 종료 정리, backpressure·입출력/turn/시간 상한 |
| 브라우저 공통 엔진 | `useAILiveSession`, `LiveClient`, `LiveAudio`; 메모리 전용 ticket, 마이크 명시 호출, PCM16 LE 입력16kHz·출력24kHz, interrupt 재생 취소·전사 상태, 오류 시 기존 음성 폴백 callback |
| 기존 기능 | VoiceOrderAssistant·TinkerBell·기존 결제 화면을 교체하지 않음. P1 UI 연결 전에는 기존 음성 주문이 계속 기본 사용자 경로 |
| CI | `ai-live-p0-tests` job: 격리 Redis 서비스, 실제 Lua 동시성 및 로컬 HTTP/WSS 통합, Provider fake. 실제 API 키 미사용 |

## 설정과 안전한 기본값

`.env.example`에만 설정 항목을 추가했다. 실제 `.env`, Render/Vercel 환경변수는 변경하지 않았다.

- `AI_LIVE_ENABLED=false`, `AI_LIVE_ALLOW_PAID=false`. 둘 중 하나라도 OFF이면 발급은 503 + `legacy_voice` 폴백이다.
- `AI_LIVE_MODEL`: 검토한 동기 Function Calling 지원 모델만 허용. 계정의 실제 모델 가용성은 유료 canary 전 별도 확인이 필요하다.
- `AI_LIVE_TICKET_SECRET`: 최소 32자 서버 secret. 기존 JWT secret 재사용·브라우저 저장 금지.
- `AI_LIVE_REDIS_URL`: 전용 내구성 Redis. 연결 실패 시 프로세스 메모리로 우회하지 않는다. 운영에서는 persistence/no-eviction/접근 통제가 필수다. Redis 초기화·소실 시 기존 예산 원장을 복구하기 전에 기능을 다시 켜면 안 된다.
- `AI_LIVE_ALLOWED_ORIGINS`: HTTPS origin 배열. 개발 환경의 localhost HTTP만 별도 허용.
- `AI_LIVE_STORE_POLICIES`: 매장 ID별 enabled, monthlyLimitMicros, reservationMicros, dailySeconds, sessionSeconds(10~600초), concurrency(1~10).
- `AI_LIVE_PRICING_JSON`: model/version/input/output. 단가는 **정수 micro-USD / 백만 토큰**이며 TEXT/AUDIO/VIDEO/IMAGE별로 검증한다. 기본 가격은 없다. 테스트의 fixture 단가는 Google 가격이 아니다.

예산은 **보수적인 admission credit/사용량 추정**이다. 종료 시 예약액과 수신된 추정액 중 큰 금액을 소비 처리하며, usage 누락·연결 실패·프로세스 crash로 예약액을 자동 환급하지 않는다. 만료된 concurrency lease만 회수한다. 이는 비용 우회 방지를 우선하므로 실제 사용보다 일찍 한도가 소진될 수 있다. 사용자 실제 청구/정산 장부로 사용하면 안 된다.

Provider 보고마다 문맥/도구/생각 토큰을 포함해 모달리티를 계산한다. 서버 수신 순서와 입력/출력/도구 토큰·생각 토큰·요금 버전·추정 비용을 Redis usage 레코드에 기록하며 본문은 기록하지 않는다. 중복 보고는 보수적으로 추가 집계될 수 있고 조기 종료로 이어질 수 있다. 보고 지연·in-flight 생성으로 예약액보다 실제 Provider 비용이 커질 수 있어 정확한 Google 청구 상한을 보장하지 않는다. 실제 요금/usage 의미, 충분한 예약액·안전 마진, Google 계정 예산 정책을 검증하기 전에는 운영 활성화하지 않는다.

월/일 경계는 한국시간으로 계산하고 세션이 날짜 경계를 넘지 않게 제한한다. 세션·예약·감사 메타데이터는 90일 TTL이며 원문 미디어는 기록하지 않는다. 이 보존 기간도 운영 정책 승인 대상이다.

## 로컬 검증

유료 Google endpoint는 호출하지 않았다. SQL DB는 조회·변경하지 않았다. 실제 Redis 검증은 `redis:7-alpine`의 별도 `--rm` 컨테이너/메모리 볼륨/127.0.0.1 임시 포트에서만 수행했다. 애플리케이션 Redis나 SQL DB를 테스트 대상으로 사용하지 않았다.

재현 명령:

```powershell
# AI_LIVE_TEST_REDIS_URL은 격리된 로컬 테스트 Redis에만 지정
node --test tests/saas/gemini-live-p0.test.cjs tests/saas/gemini-live-audio.test.cjs tests/saas/gemini-live-redis.test.cjs
node scripts/run-jest.cjs --config jest.config.js tests/unit/services/VoiceOrderService.test.js tests/unit/controllers/aiController.test.js tests/unit/controllers/tinkerbellSettings.test.js tests/unit/utils/toss.test.js --runInBand
npm run typecheck:backend
cd frontend
npx vitest run src/test/ai-live-p0.test.jsx src/test/VoiceOrderAssistant.test.jsx src/test/toss-ready-contract.test.jsx
npm run build
```

최종 로컬 결과: P0 정책/PCM/실제 격리 Redis 통합 10개 PASS, 브라우저 공통 엔진/기존 음성 주문/결제 계약 14개 PASS, 기존 VoiceOrderService/AI 컨트롤러/팅커벨 설정/Toss 단위 24개 PASS(총 48개). 백엔드 타입 검사·변경 파일 린트·프런트 빌드도 PASS. 원격 CI 상태는 PR에서 별도 확인한다. 최초 테스트는 모듈 부재로 실패를 확인했고, 이후 Redis fixture의 연결 준비 누락·브라우저 lint 오류를 수정했다. 마이크 권한 거부 시 WebSocket을 먼저 열던 순서도 실패 테스트를 확인한 뒤 오디오 준비 후 연결하도록 보강했다. 실제 외부 서비스로 우회해 테스트를 통과시키지 않았다.

## 남은 범위와 한계

1. P1 팅커벨/VoiceOrder 화면에 Live 시작·마이크 권한·자막·초안 확인 UI를 붙이는 작업은 후속이다. 이 PR은 기존 화면에 새 유료 연결을 자동 삽입하지 않는다.
2. Google 단기 토큰 직접 연결은 구현하지 않았다. P0 인증은 WEMARKET 중계 전용 일회 ticket이다. 비용 강제 제어가 어려운 브라우저 직접 연결은 별도 검증 전 비활성으로 유지한다.
3. 재개는 같은 서버 중계 프로세스 내 Provider 연결 교체다. 브라우저 WSS 단절·서버 재시작 시에는 폴백하며 서버 간 대화 복구는 제공하지 않는다. 예약은 남아 비용 회수를 우회하지 못한다.
4. 관리자 변경/승인/캠페인 실행 도구, 영상 입력은 없다. 사업자 집계는 기존 getStats의 ledger_net 기준을 재사용한다.
5. 실제 Live 음질·지연·모델 지원·청구 대조, Android/iPhone 마이크·오디오·백그라운드 동작은 미검증이다. mock/DOM/로컬 WSS 결과를 실기기 성공으로 표현하지 않는다.
6. 정확한 SQL 원장·장기 청구 대사는 DB 변경 승인을 받은 후 확장할 수 있다. 이번에는 Prisma 모델·migration을 추가하지 않았다.

## 운영·롤백

본 PR을 운영으로 머지하거나 배포하지 않는다. 검토 후 별도 승인 시에도 전역/유료 gate와 매장 policy는 OFF 유지가 기본이다. 승인된 staging의 합성 음성·제한 예산 canary, Origin/WSS 프록시·내구성 Redis·실제 모델 검증을 먼저 수행해야 한다. 기존 일반 음성 주문을 대체하는 토글은 P1 검증 이후 추가한다.

롤백은 신규 Live gate를 OFF하고 활성 세션을 종료하며 예약/감사 원장은 보존하는 방식이다. 기존 주문·결제·환불·팅커벨 자산에는 역마이그레이션이 필요하지 않다.
