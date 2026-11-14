# Live·사진·마케팅 공용 매장 월 예산

## 구현

`SharedGenerationBudget`가 Live 런타임의 **동일한 RedisLiveStore 프록시·namespace·Lua 원장**을 사용한다. 별도 월 예산 DB나 프로세스 내 예산 폴백은 만들지 않았다. SQL 스키마·데이터 변경은 없다.

- 사진 분석은 권한 검증을 통과한 canonical `store_id`, 마케팅은 서버가 조회한 매장 ID로 예약한다. 클라이언트의 예산·가격·다른 매장 정보는 사용하지 않는다.
- 기존 `AI_LIVE_STORE_POLICIES[storeId].monthlyLimitMicros`에 Live·사진·마케팅의 `spent + reserved`를 합산해 원자적으로 입장 여부를 결정한다. 매장별 원장은 분리하며 월 경계는 KST 기준이다.
- 사진/마케팅도 같은 동시 연결 제한을 사용한다. 일별 Live 음성 시간은 추가 차감하지 않는다(`seconds: 0`). API의 기존 기능별/IP 요청 제한도 유지한다.
- 사진·마케팅의 기능/유료 허용 이중 게이트, 명시적 전송 동의, 매장 권한, 최대 입력·출력 크기와 사업자 검토를 유지한다. 마케팅의 무료 기본 초안은 예산 예약이나 외부 호출 없이 계속 동작한다.
- 서버 SDK는 20초 timeout, 요청 1회(자동 재시도 비활성화)로 제한한다. 예약·정산은 모델 응답 파싱 전에 끝나므로 모델의 잘못된 JSON/빈 초안도 무료 호출이 되지 않는다.

## 정산과 장애

1. 입력·동의·권한·모델 설정 확인 후 공용 월 예산을 먼저 예약한다. 예산 부족·Redis 연결 장애·미설정/비활성 정책·단가 미등록이면 Provider를 호출하지 않는다.
2. 응답의 `usageMetadata`에서 입력 TEXT/IMAGE, 출력 TEXT 및 thoughts 토큰 수와 전체 토큰 수를 검증하고 모델별 버전 단가로 비용을 계산한다. 모달리티별 내역이 없으면 이미지 비용을 임의 추정하지 않는다.
3. 원본 사진·메뉴 문구·개인정보 없이 토큰 사용량·단가 버전·계산 비용을 기록하고 정산한 뒤에만 초안을 반환한다.
4. Live와 동일한 보수적 정책인 `chargedMicros = max(reservationMicros, estimatedMicros)`를 유지한다. 성공해도 예약 하한을 반환하지 않으며, 실제 보고 비용이 예약액보다 크면 잘라내지 않고 전액 반영한다. 토큰 기반 계산 비용은 `estimatedMicros`와 usage 기록에 별도로 남는다.
5. Provider 오류·사용량 누락·미지원 단가·사용량 기록 실패·정산 실패에서는 초안을 반환하지 않는다. 실패/재시작/크래시의 예약액을 환급해 무료 크레딧으로 만들지 않는다. 정산 명령은 기존 Lua의 중복 호출 방지를 재사용한다.

예약액보다 큰 비용은 공급자 응답 시에야 알 수 있으므로 단일 호출의 초과분까지 없앤다는 보장은 아니다. 예약액은 검토된 모델별 최대 입력/출력 비용을 고려해 운영자가 설정해야 한다. 이번 작업에서는 실제 모델 호출이나 실청구 단가 검증을 하지 않았다.

## 설정 (운영 설정은 변경하지 않음)

- 기존 `AI_LIVE_REDIS_URL`, `AI_LIVE_STORE_POLICIES`를 그대로 재사용한다. 해당 매장은 `enabled: true`여야 한다.
- 매장 정책에 `photoReservationMicros`, `marketingReservationMicros`를 추가한다. 각각 양의 정수이며 `monthlyLimitMicros` 이하여야 한다.
- 새 `AI_GENERATION_PRICING_JSON` 형식:

```json
{
  "models": {
    "YOUR_REVIEWED_MODEL": {
      "version": "reviewed-price-version",
      "input": { "TEXT": 1000000, "IMAGE": 1000000 },
      "output": { "TEXT": 1000000 }
    }
  }
}
```

위 숫자는 형식 설명용 합성 값이다. 실제 공급자 단가가 아니다. 단위는 Live와 같은 **백만 토큰당 micro-USD**, 예산/예약은 micro-USD다. 사진 모델에는 IMAGE 입력 단가도 필수다. 모델·단가 기본값은 없다. Live가 전역 OFF여도 사진/마케팅은 각각의 게이트와 공용 매장 예산을 모두 충족해야 호출할 수 있다.

## 이전 보조 경로

기존 `/ai/instagram`은 매장 범위/전송 동의 없이 옛 SDK를 호출할 수 있어 예산 우회가 가능했다. 이 엔드포인트는 외부 호출 없는 **기본 홍보 초안** 응답으로 전환했다. 기존 `copy`와 UI가 사용하는 `instagramCopy` 문자열을 함께 제공하고 `source: template`, `draft_only: true`를 표시한다. 메뉴 편집 화면에도 기본 초안임을 안내한다. 실제 AI 마케팅은 권한·동의·공용 예산이 적용된 `/ai/marketing-drafts`만 사용한다. 기존 음성 폴백 및 결제 흐름은 변경하지 않았다.

## 검증

- 백엔드 전체 209 suites / 1,627 tests 및 커버리지 기준 PASS. 프론트엔드 전체 93 files / 400 tests PASS.
- 신규 Jest: 예약 선행·KST 월·개인정보 제외·정산 선행·정책 누락/차단·잘못된 사용량·Provider/저장소 장애·예약 초과 실제 비용 정산 및 이전 인스타그램 무료 폴백 9 tests PASS.
- 격리 Redis 통합: Live 예약 30, 월 한도 100에서 사진 예약 20 요청 8개 동시 실행 → 3개만 Provider 호출. 남은 10을 마케팅이 사용한 뒤 Live·사진·마케팅 추가 입장 거부. `spent=70`, `reserved=30`, 다른 매장은 독립 허용, 실제 모달리티 계산 비용/토큰 기록 확인.
- 전체 Live/카메라/사진/마케팅 node:test: 24 PASS, SKIP 0. 가짜 Provider만 사용했다.
- 사진 수동 등록/승인·마케팅 초안/검토/복사 모바일 fixture 320px/390px 재검증 PASS. 앱 DB 쓰기·외부 유료 호출 없음.
- 변경 백엔드 lint 오류 0건, 프론트 lint 오류 0건(기존 경고 115건), 프론트/백엔드 타입 검사 및 프론트 빌드 통과.

Redis 테스트는 `127.0.0.1:16389`의 이번 검증 전용 `--rm` 컨테이너와 무작위 테스트 namespace만 사용했고 종료했다. 애플리케이션 DB/Redis·운영 환경 변수는 변경하지 않았다. 외부 게시·운영 배포·유료 API 호출은 수행하지 않았다.
