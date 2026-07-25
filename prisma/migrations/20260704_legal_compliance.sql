-- ============================================================
-- WeMarket 법적 준수 컬럼 추가 마이그레이션 (2026-07-04)
-- 전자상거래법, 통신판매업, 전자금융거래법, 개인정보보호법 대응
-- ============================================================

-- ── 통신판매업 신고 / 사업자 법적 정보 ──────────────────────────
ALTER TABLE stores ADD COLUMN IF NOT EXISTS mail_order_number       VARCHAR(50);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS business_address        TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS customer_service_phone  VARCHAR(20);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS customer_service_email  VARCHAR(100);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS pg_company              VARCHAR(50) DEFAULT '토스페이먼츠';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS pg_business_number      VARCHAR(20) DEFAULT '214-88-00591';

-- ── 고객 동의 문서 ────────────────────────────────────────────
ALTER TABLE stores ADD COLUMN IF NOT EXISTS terms_of_service  TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS privacy_policy    TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS refund_policy     TEXT;

-- ── 기존 stores 레코드에 기본 정책 문서 채우기 ───────────────────
-- (실제 배포 시 각 매장 정보에 맞게 수정 필요)
UPDATE stores
SET
    refund_policy = '■ 환불·취소 규정 (전자상거래법 제17조)
━━━━━━━━━━━━━━━━━━━━
1. 주문 전 취소: 즉시 전액 환불
2. 조리 전 취소: 즉시 전액 환불
3. 조리 중 취소: 취소 불가 (매장 재량으로 부분 환불 가능)
4. 조리 완료 후: 취소 불가 (품질 문제 제외)
5. 이물질·품질 불량: 즉시 재조리 또는 전액 환불

■ 환불 처리 기간
- 카드 결제: 영업일 3~5일 이내 취소 처리
- 계좌이체: 영업일 2~3일 이내 입금
- 현금 결제: 현장 즉시 환불

■ 문의: 매장 전화 또는 카운터 직접 방문',

    terms_of_service = '■ 서비스 이용약관
━━━━━━━━━━━━━━━━━━━━
제1조 (목적)
본 약관은 위마켓(이하 "플랫폼")이 제공하는 QR 메뉴·주문·결제 서비스(이하 "서비스")의 이용 조건을 규정합니다.

제2조 (서비스 이용)
이용자는 QR 코드를 통해 메뉴 조회, 주문 및 결제를 할 수 있습니다.

제3조 (개인정보)
플랫폼은 개인정보보호법 및 정보통신망법에 따라 이용자의 개인정보를 처리합니다.

제4조 (결제)
전자금융거래법에 따라 결제 정보는 PG사(토스페이먼츠)를 통해 안전하게 처리됩니다.

제5조 (책임 제한)
천재지변·서버 장애 등 불가항력으로 인한 서비스 중단에 대해 플랫폼은 책임을 지지 않습니다.

제6조 (분쟁 해결)
서비스 이용 중 발생한 분쟁은 대한민국 법률을 적용하며, 관할 법원은 서울중앙지방법원으로 합니다.',

    privacy_policy = '■ 개인정보처리방침
━━━━━━━━━━━━━━━━━━━━
1. 수집 항목: 이름, 전화번호, 주문 내역
2. 수집 목적: 주문 처리, 포인트 적립, 고객 알림
3. 보유 기간: 주문일로부터 5년 (전자상거래법 제6조)
4. 제3자 제공: PG사(토스페이먼츠) — 결제 처리 목적에 한함
5. 개인정보 보호책임자: 매장 대표자
6. 이용자 권리: 열람·정정·삭제·처리정지 요청 가능 (매장 카운터 또는 플랫폼 고객센터)

■ 개인정보 안전 조치
- 비밀번호 암호화 저장
- SSL/TLS 암호화 전송
- 접근권한 최소화'
WHERE terms_of_service IS NULL;

-- ── 인덱스 (법적 정보 조회 최적화) ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_stores_mail_order ON stores (mail_order_number) WHERE mail_order_number IS NOT NULL;
