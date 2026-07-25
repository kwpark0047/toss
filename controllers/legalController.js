const Store = require("../repositories/Store");
const catchAsync = require("../utils/catchAsync");
const { AppError } = require("../utils/errorHandler");

const isValidBusinessNumber = (num) => {
    if (!num) return false;
    const digits = num.replace(/[^0-9]/g, '');
    if (digits.length !== 10) return false;
    const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += weights[i] * parseInt(digits[i]);
    sum += Math.floor((5 * parseInt(digits[8])) / 10);
    return (10 - (sum % 10)) % 10 === parseInt(digits[9]);
};

function getDefaultTerms(storeName) {
    return `■ ${storeName || '매장'} 서비스 이용약관
(시행일: ${new Date().toLocaleDateString('ko-KR')})

제1조 (목적)
이 약관은 ${storeName}(이하 "매장")이 제공하는 QR 주문·결제 서비스의 이용 조건을 정합니다.

제2조 (서비스 이용)
이용자는 QR 코드 접속을 통해 메뉴 조회, 주문 및 결제 서비스를 이용할 수 있습니다.

제3조 (결제)
모든 결제는 전자금융거래법에 따라 PG사(토스페이먼츠)를 통해 안전하게 처리됩니다.
결제 수단: 현금, 카드 단말기, 계좌이체

제4조 (청약철회 및 환불)
전자상거래법 제17조에 따라 결제 후 7일 이내 청약철회가 가능합니다.
단, 조리 완료된 음식의 경우 청약철회가 제한될 수 있습니다.

제5조 (개인정보)
이용자의 개인정보는 개인정보처리방침에 따라 처리됩니다.

제6조 (분쟁 해결)
서비스 이용 관련 분쟁은 전자거래분쟁조정위원회(www.ecmc.or.kr, 1661-5714)에 조정을 신청할 수 있습니다.
관할 법원: 서울중앙지방법원`;
}

function getDefaultPrivacy(storeName, ceoName) {
    return `■ ${storeName || '매장'} 개인정보처리방침
(시행일: ${new Date().toLocaleDateString('ko-KR')})

1. 개인정보 수집·이용 목적
   - 주문 처리 및 결제
   - 포인트 적립·사용
   - 주문 현황 알림
   - 서비스 품질 향상

2. 수집하는 개인정보 항목
   - 필수: 전화번호, 주문 내역, 결제 정보
   - 선택: 이름

3. 개인정보 보유 및 이용 기간
   - 전자상거래법: 주문·결제 정보 5년
   - 개인정보보호법: 회원 탈퇴 즉시 삭제 (단, 법정 의무 보유 기간 제외)

4. 개인정보 제3자 제공
   - PG사(토스페이먼츠): 결제 처리 목적
   - 제공 항목: 주문금액, 주문번호
   - 이외 제3자 제공 없음

5. 개인정보 처리 위탁
   - 수탁자: 토스페이먼츠 주식회사 (결제 대행)

6. 개인정보보호 책임자
   - 성명: ${ceoName || '대표자'}
   - 연락처: 매장 카운터 문의

7. 이용자 권리
   개인정보 열람·정정·삭제·처리정지를 요청할 수 있습니다.
   요청처: 매장 카운터 또는 플랫폼 고객센터

8. 개인정보 안전성 확보 조치
   - 비밀번호 및 결제정보 암호화 저장
   - SSL/TLS 암호화 전송
   - 내부 관리자 접근권한 최소화`;
}

function getDefaultRefundPolicy() {
    return `■ 환불·취소 규정 (전자상거래법 제17조)

1. 조리 전 취소: 즉시 전액 환불
2. 조리 중 취소: 매장 재량 (부분 환불 가능)
3. 조리 완료 후: 원칙적 취소 불가
   - 이물질·품질 불량: 재조리 또는 전액 환불
   - 알레르기 오표기: 전액 환불

4. 환불 처리 기간 (전자금융거래법 기준)
   - 신용카드: 영업일 3~5일 이내
   - 계좌이체: 영업일 2~3일 이내
   - 현금: 현장 즉시 환불

5. 청약철회 (전자상거래법 제17조)
   - 결제일로부터 7일 이내 청약철회 가능
   - 단, 소비된 음식·음료는 청약철회 대상 제외

6. 분쟁 조정
   전자거래분쟁조정위원회 1661-5714`;
}

const legalController = {
    // [전자상거래법 표시사항 조회]
    getStoreDisclosures: catchAsync(async (req, res) => {
        const store = await Store.findById(req.params.storeId);
        if (!store) throw new AppError('매장을 찾을 수 없습니다.', 404);

        const validated = isValidBusinessNumber(store.business_number);

        res.success({
            store_id:              store.id,
            store_name:            store.name,
            business_name:         store.business_name  || store.name,
            ceo_name:              store.ceo_name        || '미등록',
            business_number:       store.business_number || '미등록',
            business_number_valid: validated,
            business_address:      store.business_address || store.address || '미등록',
            customer_service_phone: store.customer_service_phone || store.phone || '미등록',
            customer_service_email: store.customer_service_email || '미등록',
            mail_order_number:     store.mail_order_number || '미신고',
            pg_company:            store.pg_company || '토스페이먼츠',
            pg_info: {
                name:            store.pg_company || '토스페이먼츠',
                business_number: store.pg_business_number || '214-88-00591',
                customer_center: '1544-7772',
                url:             'https://www.tosspayments.com',
            },
            withdrawal_period_days: 7,
            required_disclosures: [
                '상품명 및 가격',
                '배송비 (해당 시)',
                '청약철회 기간 및 방법',
                '환불 처리 기간',
            ],
        });
    }),

    // [이용약관 조회]
    getStoreTerms: catchAsync(async (req, res) => {
        const store = await Store.findById(req.params.storeId);
        if (!store) throw new AppError('매장을 찾을 수 없습니다.', 404);
        res.success({ content: store.terms_of_service || getDefaultTerms(store.name) });
    }),

    // [개인정보처리방침 조회]
    getStorePrivacy: catchAsync(async (req, res) => {
        const store = await Store.findById(req.params.storeId);
        if (!store) throw new AppError('매장을 찾을 수 없습니다.', 404);
        res.success({ content: store.privacy_policy || getDefaultPrivacy(store.name, store.ceo_name) });
    }),

    // [환불정책 조회]
    getStoreRefundPolicy: catchAsync(async (req, res) => {
        const store = await Store.findById(req.params.storeId);
        if (!store) throw new AppError('매장을 찾을 수 없습니다.', 404);
        res.success({ content: store.refund_policy || getDefaultRefundPolicy() });
    }),

    // [관리자용 전체 법적 정보 조회]
    adminGetStoreLegal: catchAsync(async (req, res) => {
        const store = await Store.findById(req.params.storeId);
        if (!store) throw new AppError('매장을 찾을 수 없습니다.', 404);
        
        // 특정 법적 정보 필드 필터링
        const filteredStore = {
            id: store.id,
            name: store.name,
            business_name: store.business_name,
            business_number: store.business_number,
            ceo_name: store.ceo_name,
            tax_invoice_email: store.tax_invoice_email,
            business_address: store.business_address,
            customer_service_phone: store.customer_service_phone,
            customer_service_email: store.customer_service_email,
            mail_order_number: store.mail_order_number,
            pg_company: store.pg_company,
            pg_business_number: store.pg_business_number,
            terms_of_service: store.terms_of_service,
            privacy_policy: store.privacy_policy,
            refund_policy: store.refund_policy
        };

        res.success({ ...filteredStore, business_number_valid: isValidBusinessNumber(store.business_number) });
    }),

    // [관리자용 법적 정보 수정]
    adminUpdateStoreLegal: catchAsync(async (req, res) => {
        const {
            business_name, business_number, ceo_name, tax_invoice_email,
            business_address, customer_service_phone, customer_service_email,
            mail_order_number, pg_company, pg_business_number,
            terms_of_service, privacy_policy, refund_policy,
        } = req.body;

        if (business_number && !isValidBusinessNumber(business_number)) {
            throw new AppError('유효하지 않은 사업자등록번호입니다. 국세청 검증 알고리즘 불일치.', 400);
        }

        if (mail_order_number && !/^[\w가-힣]+-\d{4}-\d+$/.test(mail_order_number)) {
            throw new AppError('통신판매업신고번호 형식이 올바르지 않습니다. (예: 서울금천-2024-0001)', 400);
        }

        const updated = await Store.updateLegalInfo(req.params.storeId, {
            business_name, business_number, ceo_name, tax_invoice_email,
            business_address, customer_service_phone, customer_service_email,
            mail_order_number, pg_company, pg_business_number,
            terms_of_service, privacy_policy, refund_policy,
        });

        res.success(updated, '법적 정보가 업데이트되었습니다.');
    }),

    // [사업자등록번호 유효성 검증]
    adminVerifyBusiness: catchAsync(async (req, res) => {
        const { business_number } = req.body;
        const valid = isValidBusinessNumber(business_number);
        res.success({
            valid,
            formatted: business_number?.replace(/[^0-9]/g, '').replace(/(\d{3})(\d{2})(\d{5})/, '$1-$2-$3'),
            message:   valid ? '유효한 사업자등록번호입니다.' : '국세청 알고리즘 검증 실패. 사업자등록번호를 다시 확인하세요.',
        });
    })
};

module.exports = legalController;
