# WeMarket Open Commerce Hub — Open API v1

외부 시스템(POS·배달·키오스크·ERP·CRM)이 WeMarket 매장 데이터와 주문을
프로그램적으로 연동하기 위한 공개 API. 인증은 매장별 **API 키**로 하며, 모든
응답은 키에 묶인 매장으로 자동 스코프된다(멀티테넌트 격리).

Base URL: `https://wemarket.onrender.com/api/v1`

---

## 인증

발급받은 API 키를 헤더로 전달한다.

```
X-API-Key: wm_live_xxxxxxxxxxxx
# 또는
Authorization: Bearer wm_live_xxxxxxxxxxxx
```

- 스코프: `read`(조회), `write`(주문 생성). 키 발급 시 지정.
- 키는 발급 시 1회만 평문 노출되며 서버에는 SHA-256 해시만 저장된다.
- 매장 소유주가 개발자 포털에서 발급/폐기: `POST /api/developer/stores/:storeId/api-keys`

오류 응답: `{ "error": "<code>", "message": "<설명>" }`
- `401 unauthorized` — 키 없음/무효/폐기
- `403 insufficient_scope` — 스코프 부족
- `400 invalid_request` — 잘못된 요청

---

## 엔드포인트

### GET /store
매장 프로필.
```json
{ "data": { "id": 3, "name": "강남3", "address": "...", "open_time": "10:00", ... } }
```

### GET /menus
매장 메뉴 목록.
```json
{ "data": [ { "id": 11, "name": "떡볶이", "price": 3000, "is_sold_out": false, ... } ], "meta": { "count": 1 } }
```

### GET /orders?status=&date=&limit=
주문 목록. `status`(콤마 다중), `date`(YYYY-MM-DD, KST), `limit`(최대 200).
전화번호는 마스킹(`010-****-5678`)되어 반환된다.

### GET /orders/:id
단일 주문 상세.

### POST /orders  *(write 스코프)*
외부 주문 주입. **매장의 실제 `product_id`를 참조**해야 하며(GET /menus로 조회),
가격·재고는 서버가 DB 기준으로 재계산·차감한다(클라이언트 가격 위변조 불가).
```json
// 요청
{ "items": [ { "product_id": 11, "quantity": 2 } ], "table_id": 17, "customer_phone": "01012345678" }
// 응답 201
{ "data": { "id": 33, "order_number": "20260705-5169", "status": "pending", "total_amount": 6000 } }
```

### GET /analytics/summary?date=
매출 요약(주문수·매출·객단가).

---

## 웹훅

매장 이벤트를 실시간으로 수신한다. 개발자 포털에서 엔드포인트(https URL) 등록 시
서명용 `secret`이 1회 발급된다.

**이벤트 타입**: `order.created`, `order.updated`, `order.completed`

**페이로드**
```json
{
  "id": "evt_1783...",
  "type": "order.created",
  "created": 1783257000,
  "store_id": 3,
  "data": { "order_id": 33, "order_number": "20260705-5169", "total_amount": 6000, "source": "qr" }
}
```

**서명 검증** — 수신 측은 반드시 서명을 검증한다.
- 헤더: `X-WeMarket-Signature: t=<unix_ts>,v1=<hex>`
- 계산: `HMAC_SHA256(secret, "<t>.<raw_body>")` 가 `v1`과 일치하는지 확인
- 재전송 공격 방지: `t`가 현재 시각과 크게 차이나면 거부(예: ±5분)

```js
// Node.js 검증 예시
const crypto = require('crypto');
function verify(rawBody, header, secret) {
  const m = header.match(/t=(\d+),v1=([a-f0-9]+)/);
  if (!m) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${m[1]}.${rawBody}`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(m[2]));
}
```

**재시도**: 2xx 미수신 시 지수 백오프(1→5→30→120→360분)로 최대 5회 재전송.
전송 이력은 `GET /api/developer/stores/:storeId/webhook-deliveries`로 조회.

---

## 개발자 포털 (매장 소유주, JWT 인증)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET/POST/DELETE | `/api/developer/stores/:storeId/api-keys` | API 키 발급·목록·폐기 |
| GET/POST/DELETE | `/api/developer/stores/:storeId/webhooks` | 웹훅 등록·목록·삭제 |
| GET | `/api/developer/stores/:storeId/webhook-deliveries` | 웹훅 전송 로그 |

---

## 아키텍처 노트

- **격리**: API 키 → store_id 매핑으로 모든 쿼리가 자동 스코프. 타 매장 데이터 접근 불가.
- **보안**: 키는 해시 저장, 웹훅은 HMAC 서명, PII(전화번호)는 마스킹. 결제 카드정보 미저장.
- **확장**: 이벤트는 `services/webhookDispatcher.emitEvent(storeId, type, data)`로 발행.
  POS 연동·배달 플랫폼·ERP 등 신규 소비자는 웹훅 구독만으로 연결(코드 변경 최소).
