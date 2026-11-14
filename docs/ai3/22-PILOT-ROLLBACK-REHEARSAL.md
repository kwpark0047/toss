# 단일 매장 파일럿 롤백 모의 실행 결과

2026-11-15 KST. 기준 main `cc760354`. [절차서](21-SINGLE-STORE-PILOT-RUNBOOK.md)를 가짜 Provider와 격리 로컬 Redis로 검증했다. 실제 운영 활성화·재시작·롤백·유료 음성 품질 시험은 실행하지 않았다.

## 환경과 격리

- 새 테스트: `tests/saas/pilot-rollback.test.cjs`. 실제 LiveGateway·RedisLiveStore 및 루프백 HTTP/WebSocket 연결을 사용한다. Provider는 명시 주입한 객체이며 Gemini SDK·운영 runtime·Prisma·앱 DB를 로드하지 않는다.
- 전용 Redis: `wemarket-pilot-rehearsal`, `redis:7-alpine`, `--rm`, `127.0.0.1:16389`. 테스트별 임의 namespace를 사용하고 다른 원장에 접근하지 않는다. 검증 도중 원장을 지우지 않고 OFF Gateway 재생성과 중복 정산 이후까지 보존을 검사했다. 검증 종료 후 컨테이너를 중지·제거했다. 이는 운영 원장 삭제를 의미하지 않는다.
- 저장소 설정·실제 환경 파일·운영 플래그는 변경하지 않았다. 활성화 시뮬레이션은 JSON의 복사본을 메모리에서만 변경했다. 매장 3 하나만 허용하고 매장 4는 거부했다. 사진·마케팅·카메라 gate는 OFF다.
- 실제 Provider 네트워크 호출 0. 합성 사용량과 예약액만 계산하며 카드·고객정보를 사용하지 않는다.

## 순서와 판정

| 단계 | 관찰 결과 | 판정 |
| --- | --- | --- |
| 단일 매장 admission | 비대상 매장 4 거부, 매장 3의 실제 로컬 ticket·WebSocket 인증 | 통과 |
| 첫 세션 Provider 오류 | fallback 이벤트 전송, 가짜 Provider close 1회, Gateway 활성 연결 0 | 통과 |
| 두 번째 세션 | 가짜 Provider 연결, 합성 TEXT 입력 1,000토큰 usage 기록 1개 | 통과 |
| gate OFF | 새 세션 발급 거부 | 통과 |
| 명시적 연결 drain | `attach()`가 반환한 detach 호출, Provider close 누적 2회, 활성 연결 0 | 통과 |
| 브라우저 연결 종료 | WebSocket 코드 1000, 사유 `Use existing voice ordering` | 통과 |
| 원장 보존 | 아래 예약·정산·일별 시간·사용량 기록 확인, TTL 양수 | 통과 |
| OFF 재시작 모의 | 같은 Redis namespace를 사용하는 새 Store/Gateway 객체에서 admission 거부, 원장 동일 | 통과 |
| 중복 종료 | finish 재호출 후 원장 동일, 중복 차감·환급 없음 | 통과 |

Gateway 재생성은 프로세스 재시작의 **모의**다. 실제 OS 프로세스 재시작·Render 종료 경로·TLS 프록시·기기 마이크 해제의 운영 검증을 대신하지 않는다. gate 변경만으로 활성 연결 종료가 된다고 가정하지 않고 명시적 drain을 별도 실행했다.

## 예산 원장 증거

단위는 micro-USD이며 검토안의 Live 예약액 100,000을 사용했다. 합성 단가는 검토안의 TEXT 백만 토큰당 750,000이다. 실제 청구액이 아니다.

| 항목 | 두 번째 세션 활성 시 | 롤백 후 / OFF 재시작 후 |
| --- | --- | --- |
| spent | 100,000 | 200,000 |
| reserved | 100,000 | 0 |
| KST 2026-11-15 예약 시간 | 60초 | 60초 |
| 두 번째 세션 사용량 기록 | 1개 | 1개 |
| 두 번째 세션 상태 | active | closed |

첫 오류 세션은 사용량이 없어도 예약 하한 100,000을 정산했다. 두 번째 세션은 계산 사용량 750, 예약 하한 적용 정산 100,000이다. 롤백은 예산을 초기화하거나 사용 시간을 환급하지 않았다. 사용량 기록·세션 상태·월 원장이 유지되며 중복 close는 멱등적이다.

## 폴백·권한·예산 회귀 결과

- OFF 설정/도구 5건 통과: 13개 매장 및 유료/UI/카메라 gate OFF, 무료 템플릿, 유료 진입 거부.
- 모의 롤백 1건 + 기존 Live·미디어·매장 권한·공용 월 예산 28건 = **29건 통과, 생략 0**. 소진·동시 요청·KST 월 경계·Redis 장애 시 차단을 포함한다.
- 프론트 8파일 **38건 통과**: Live 훅·팅커벨·Voice Order·Manager 승인·사진·마케팅·주문 초안. 기존 음성 주문으로 복귀하면서 장바구니를 추가하지 않는 동작, 명시적 고객 확인, 소유주 승인 후 최종 실행 확인 경계를 검증한다. 기존 브라우저 음성 인식의 실제 기기 음질·인식률은 검증하지 않았다.
- 합계 **72건 통과**. 문서 작성용 단순 검사는 테스트 수에 포함하지 않았다.

## 재실행

전용 임시 Redis 컨테이너를 먼저 실행한다. 기존 또는 운영 Redis 주소를 지정하지 않는다. PowerShell 예시:

```powershell
docker run --detach --rm --name wemarket-pilot-rehearsal -p 127.0.0.1:16389:6379 redis:7-alpine
$env:AI_LIVE_TEST_REDIS_URL = 'redis://127.0.0.1:16389'
try {
  npm run ai:review:check
  node --test tests/saas/pilot-rollback.test.cjs
} finally {
  Remove-Item Env:AI_LIVE_TEST_REDIS_URL
  docker stop wemarket-pilot-rehearsal
}
```

전용 포트/이름이 사용 중이면 기존 컨테이너를 중지하지 말고 새 이름·루프백 포트를 선택한다. Redis 주소 미지정 시 새 테스트는 생략되므로 생략을 성공으로 보고하지 않는다. 전체 회귀 명령과 실운영 점검 항목은 절차서를 따른다.

## 종료 상태

모든 실제 활성화·유료 호출 플래그 OFF 유지. 운영 배포·운영/기존 DB 변경·운영 Redis 접근·유료 API 호출·외부 게시 없음. 결과는 모의 실행 범위의 통과이며 실운영 파일럿 체크박스는 미체크로 유지한다. 결과 문서와 재실행 테스트를 PR로 제출하며, 기존 `ai-live-p0-tests` CI의 격리 Redis 환경에서도 롤백 테스트를 실행한다. CI의 실제 유료 호출 gate는 false, API 키는 빈칸을 유지한다.
