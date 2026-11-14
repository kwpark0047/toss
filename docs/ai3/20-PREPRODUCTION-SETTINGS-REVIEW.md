# Gemini 운영 적용 전 설정 검토안

검토일: 2026-11-15 KST. 기준 main `71eca285`. 이 문서는 **설정 제안**이며 운영 환경에 적용하지 않았다. `config/ai/preproduction-review.json`의 모든 기능·유료 허용·매장·UI 플래그는 OFF다. 키·ticket secret·Redis URL은 빈칸이다.

## 모델과 공식 단가

Google 공식 문서에서 확인한 Standard 유료 단가를 기준으로 한다. 단위는 USD / 백만 토큰이며, 무료·Batch·캐시 할인이나 분당 단순 추정값은 예산 계산에 적용하지 않는다.

| 용도 | 초기 후보 | 입력 | 출력 |
| --- | --- | --- | --- |
| 팅커벨·음성 주문·Manager Live | `gemini-3.8-live` | TEXT $0.75 / AUDIO $3.00 / IMAGE·VIDEO $1.00 | TEXT $4.50 / AUDIO $12.00 |
| 사진 분석·마케팅 초안 | `gemini-3.5-flash-lite` | TEXT·IMAGE $0.30 | TEXT $2.50 (thinking 포함) |

출처: [공식 Live 단가](https://aistudio.google.com/docs/pricing#gemini-3.8-live), [공식 Flash-Lite 단가](https://aistudio.google.com/docs/pricing#gemini-3.5-flash-lite), [Live 모델 기능](https://aistudio.google.com/docs/models/gemini-3.8-live), [Flash-Lite 모델 기능](https://aistudio.google.com/docs/models/gemini-3.5-flash-lite).

3.8 Live는 공식 문서에서 동기·비동기 함수 호출을 지원하며 현재 코드의 허용 목록에 있다. 3.5 Flash-Lite는 이미지 입력·구조화 출력을 지원하므로 사진 메뉴 초안 및 마케팅 JSON 후보로 선정했다. 실제 계정의 모델 가용성·SDK 연결·응답 품질·usageMetadata 형식은 유료 호출을 하지 않아 미검증이다.

현재 코드의 3.8 Live에는 Vision 허용 표시가 없으므로 **초기 Live 카메라는 OFF**다. 공식 모델의 이미지 지원과 앱의 카메라 허용은 별도 조건이다. 향후 Vision 활성화는 모델 허용·IMAGE/VIDEO 단가·매장 설정·카메라 동의까지 다시 검증한 뒤 검토한다.

## 예산·예약 제안

실사용 자료가 없으므로 우선 1개 매장 기능 점검용 소액 한도를 제안한다. 공급자 가격과 달리 아래 한도·예약액은 내부 운영 제안값이다.

| 항목 | 초기 제안 |
| --- | --- |
| 파일럿 후보 | 과거 테스트 매장 ID 3, 현재 OFF |
| 매장별 공용 월 한도 | $10 = 10,000,000 micro-USD |
| Live 1세션 예약 | $0.10 = 100,000 micro-USD |
| 사진 1회 예약 | $0.02 = 20,000 micro-USD |
| 마케팅 1회 예약 | $0.01 = 10,000 micro-USD |
| Live 일별 예약 시간 | 600초 |
| Live 세션 | 최대 30초 |
| 매장 동시 요청 | 1개, 세 기능 공유 |
| 카메라 | OFF |

JSON에는 최근 합성 주문 보고서에서 확인한 ID 1~13 각각의 독립 정책을 넣었다. ID 3과 나머지 12개 모두 OFF, 월 한도는 각각 $10 제안이다. 현재 DB에 매장 정보를 다시 조회하지 않았으므로 적용 전에 ID·소유주·활성 대상을 재대조해야 한다. 13개를 모두 활성화한다고 가정하면 명목 한도 합계는 월 $130이며, 현재 코드는 별도의 전사 합산 상한을 강제하지 않는다.

서버는 `spent + reserved`를 같은 매장/KST 월 원장에서 검사한다. Live와 동일하게 정산 하한은 `max(예약액, 보고된 계산 비용)`이다. 위 예약 하한만 적용된다는 가정에서는 월 $10으로 Live 100회 또는 사진 500회 또는 마케팅 1,000회를 단독 사용할 수 있다. 실제 혼합 사용·추가 컨텍스트·보고 비용이 크면 가능 횟수는 줄어든다. 이 숫자는 공급자 실청구 예측이 아니다.

`AI_LIVE_PRICING_JSON`과 `AI_GENERATION_PRICING_JSON`에는 **백만 토큰당 micro-USD**를 넣는다. 예: $0.30 → 300,000. `monthlyLimitMicros` 및 예약액은 총액 micro-USD다. 반복 컨텍스트/도구 입력·thinking 토큰을 포함해 모달리티별 내역으로 계산하며, 미등록 단가·불완전 사용량은 차단한다. 세금·환율·Redis/Render/Vercel 비용은 별도다. 공급자 보고 지연이나 실제 비용의 예약액 초과 가능성은 기존 검증 보고서의 제한을 따른다.

## 적용 전 충족할 사항

- 제안 가격을 적용 시점 공식 가격표 및 계정 조건과 다시 대조하고 가격 version을 갱신한다. 서버 키는 비밀 관리 경로로만 설정한다.
- `AI_LIVE_TICKET_SECRET`은 32자 이상, `AI_LIVE_REDIS_URL`은 인증·TLS·영속성이 확보된 전용 Redis를 사용한다. 이 검토안에는 실제 비밀을 생성하거나 저장하지 않았다.
- 허용 Origin 초안은 `https://wemarket-saas.vercel.app` 하나다. 추가 도메인은 실제 운영 출처와 대조한다.
- 처음에는 매장 ID 3 하나만 승인 후보로 검토한다. 전 매장 동시 활성화나 기존 음성 기능 설정을 자동 변경하지 않는다.
- 실제 API 가용성·한국어 응답·모달리티별 사용량 및 청구 비교는 추후 별도 허용된 검증에서 진행해야 한다. 현재 결과는 보호 동작과 설정 구조 검증이다.
- 운영 배포 차단 `ENABLE_PRODUCTION_DEPLOY=false`, Vercel main/master Git 배포 차단 및 Render 자동 배포 OFF는 유지한다. 이번 작업에서 이 값을 변경하지 않는다.

## 보호 동작 검증

설정안 전용 테스트는 13개 정책의 OFF 상태·한도/예약 관계·모델 허용·단가 단위·무료 초안·서버/매장 유료 차단을 검사한다. 모의 사용량 1,000 TEXT+1,000 AUDIO 입력 및 1,000 AUDIO 출력의 계산값은 $0.01575, 1,000 TEXT+1,000 IMAGE 입력 및 1,000 TEXT 출력은 $0.0031로 검산했다.

별도로 기존 Live/권한/Manager/사진/마케팅/Redis 소진·동시성·월 경계·장애 통합 테스트와 고객·사업자 승인 UI 테스트를 실행한다. 모든 Provider·계정·메뉴는 합성 fixture를 사용하고 실제 고객정보·카드·유료 API를 사용하지 않는다. 검증은 아래 저장소 명령과 PR의 CI 결과로 확인한다.

## 재생성 및 CI 검사

```sh
npm run ai:review:generate
npm run ai:review:check
```

생성기는 저장소의 검토 JSON만 생성한다. `--check`는 읽기 전용이며 임의 작업 경로에서도 같은 파일을 검사한다. `--apply` 등 다른 인수는 거부한다. 실제 환경 변수·DB·외부 API에 접근하지 않는다. CI는 JSON 변조·모든 활성화 플래그·13개 매장 정책·단가 단위·유료 호출 차단·무료 템플릿 폴백을 검사한다. 운영 적용 기능은 제공하지 않는다.
