# Toss Payments 운영 결제 검증 런북

출시 게이트 2번(실결제·환불·웹훅·원장 대사)을 위한 체크리스트다. **실제 돈이 움직이므로 모든 단계는 사람이 직접 수행·확인한다.**

## 0. 사전 조건 (사용자 작업)

- [ ] Toss Payments 가맹 계약 완료, **운영 MID** 발급
- [ ] 운영 키 발급: 클라이언트 키(`live_ck_…`), 시크릿 키(`live_sk_…`), 웹훅 시크릿/서명 시크릿
- [ ] Render 운영 서비스 환경변수 설정: `TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`, `TOSS_WEBHOOK_SECRET`, `TOSS_WEBHOOK_SIGNING_SECRET`, `TOSS_WEBHOOK_IPS`
- [ ] 매장별 키를 쓰는 경우 관리자 화면 `ProviderCredentialPanel`(provider_credentials)로 등록, 평문 노출 없음 확인
- [ ] Toss 개발자센터에 웹훅 URL 등록: `https://<운영 도메인>/api/payments/webhooks/toss`
- [ ] 검증 전용 매장·메뉴(소액, 예: 100원) 준비, 검증 담당자 카드 준비
- [ ] 검증 시작 SHA 기록 (`/api/health` 의 `revision`)

## 1. 결제 승인

| # | 절차 | 확인 |
|---|---|---|
| 1-1 | 고객 메뉴판에서 소액 메뉴 주문 → 카드 결제 | Toss 결제창 → `/payment/success` 리다이렉트 |
| 1-2 | `POST /api/payments/:orderId/confirm` 성공 | 주문 상태 `paid`, `payments` 행 `DONE`, `payment_key` 마스킹 저장 |
| 1-3 | 같은 confirm 재요청(새로고침) | 중복 승인 없음 (IdempotencyRecord) |
| 1-4 | Toss 상점관리자 거래내역 | 금액·주문번호 일치 |
| 1-5 | 간편결제(토스페이 등) 1건 | `easy_pay_provider` 기록 |

## 2. 실패·취소 경로

- [ ] 결제창에서 사용자 취소 → `/payment/fail`, 주문 미결제 유지, 재시도 가능
- [ ] 한도초과 등 승인 실패 → 사용자 안내 문구, `payments` 실패 상태 기록

## 3. 환불

| # | 절차 | 확인 |
|---|---|---|
| 3-1 | 관리자에서 전액 취소 (`POST /api/payments/order/:orderId/cancel`) | Toss 취소 성공, 주문 `cancelled/refunded`, `refund_operations` 완료 |
| 3-2 | 부분 취소 (`POST /api/payments/order/:orderId/partial-cancel`) | 잔액 일치, 재고 보상(`inventory_compensations`) |
| 3-3 | 취소 요청 중 네트워크 오류 재현 불가 시 | `scripts/reconcile-refunds-readonly.cjs` 로 미완료 환불 0건 확인 |
| 3-4 | 권한 | staff/kitchen 계정으로 취소 시도 → 거부 |

## 4. 웹훅

- [ ] 결제 승인/취소 후 웹훅 수신 로그 확인 (`payment_webhook_inbox`)
- [ ] 서명 검증 실패 요청(잘못된 서명) → 거부되고 처리되지 않음
- [ ] 같은 웹훅 재전송(Toss 콘솔 재발송) → 중복 처리 없음
- [ ] `TOSS_WEBHOOK_IPS` 외 IP 요청 거부

## 5. 원장 대사

- [ ] 검증 기간의 Toss 거래내역(엑셀) 다운로드
- [ ] DB `payments` / `refund_operations` / `ledger` / `settlements` 와 건별 대조: 주문ID, 금액, 상태, 승인·취소 시각
- [ ] 불일치 0건 또는 불일치 사유 기록
- [ ] 매장 정산 화면(`/admin/stores/:id/settlements`) 합계와 Toss 정산 예정액 비교 (수수료 반영)

## 6. 종료

- [ ] 검증용 결제 전부 환불 완료
- [ ] 결과 문서를 `docs/verification/TOSS_LIVE_VERIFICATION_<날짜>.md` 로 기록 (SHA, 건수, 불일치, 스크린샷)
- [ ] 키·카드번호·결제키 원문은 문서에 남기지 않는다
