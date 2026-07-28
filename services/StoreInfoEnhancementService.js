const aiService = require('./aiService');
const Store = require('../repositories/Store');
const StoreService = require('./StoreService');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');

class StoreInfoEnhancementService {
    constructor() {
        this.storeService = new StoreService();
    }

    // 필수 필드 정의 (한국 법적 필수 항목 포함)
    getRequiredFields() {
        return {
            // 기본 필수 필드
            basic: ['name', 'address', 'phone'],
            
            // 법적 필수 필드 (전자상거래법·통신판매업)
            legal: [
                'business_number',      // 사업자등록번호
                'business_name',        // 법인명/상호명
                'ceo_name',             // 대표자명
                'tax_invoice_email',    // 세금계산서 수신 이메일
                'mail_order_number',    // 통신판매업신고번호
                'business_address',     // 사업장 소재지 (도로명)
                'customer_service_phone', // 고객센터 전화번호
                'customer_service_email', // 고객센터 이메일
                'terms_of_service',     // 이용약관
                'privacy_policy',       // 개인정보처리방침
                'refund_policy'         // 환불·취소 정책
            ],
            
            // 정산 설정
            settlement: [
                'settlement_cycle',     // DAILY|WEEKLY|MONTHLY|MANUAL
                'commission_rate',      // 플랫폼 수수료율
                'vat_rate'              // 부가세율
            ],
            
            // 결제 수단
            payment: ['enabled_payment_methods'],
            
            // 영업 시간
            hours: ['open_time', 'close_time', 'business_hours'],
            
            // 선택 필드 (운영 편의성)
            optional: [
                'description',          // 매장 설명
                'business_type',        // 업종
                'business_name',        // 법인명/상호명
                'ceo_name',             // 대표자명
                'tax_invoice_email',    // 세금계산서 이메일
                'mail_order_number',    // 통신판매업 신고번호
                'business_address',     // 사업장 소재지
                'customer_service_phone',
                'customer_service_email',
                'pg_company',           // PG사명
                'pg_business_number',   // PG사 사업자번호
                'terms_of_service',     // 이용약관
                'privacy_policy',       // 개인정보처리방침
                'refund_policy',        // 환불/취소 정책
                'settlement_cycle',     // 정산 주기
                'commission_rate',      // 수수료율
                'vat_rate',             // 부가세율
                'enabled_payment_methods',
                'open_time',
                'close_time',
                'business_hours',       // 요일별 영업시간 JSON
                'theme',                // 테마 설정
                'plan',                 // 플랜
                'latitude',             // 위도
                'longitude',            // 경도
                'can_send_sms'          // SMS 발송 가능 여부
            ]
        };
    }

    // 매장 정보 완성도 계산
    calculateCompletionScore(store) {
        const fields = this.getRequiredFields();
        let total = 0;
        let filled = 0;
        
        // 가중치 설정
        const weights = {
            basic: 1.5,
            legal: 2.0,
            settlement: 1.5,
            payment: 1.5,
            hours: 1.0,
            optional: 0.5
        };

        Object.entries(fields).forEach(([category, fieldList]) => {
            const weight = weights[category] || 1.0;
            fieldList.forEach(field => {
                total += weight;
                const value = this.getNestedValue(store, field);
                if (value !== null && value !== undefined && value !== '') {
                    filled += weight;
                }
            });
        });

        const score = total > 0 ? Math.round((filled / total) * 100) : 0;
        
        // 누락 필드 상세 분석
        const missing = this.getMissingFields(store);
        
        return {
            score,
            totalFields: Object.values(fields).flat().length,
            filledFields: Object.values(fields).flat().filter(f => this.getNestedValue(store, f)).length,
            missingByCategory: missing,
            isComplete: score >= 80,
            isLegalComplete: this.isLegalComplete(store),
            canOperate: score >= 60 && this.isLegalComplete(store)
        };
    }

    // 중첩 객체 값 가져오기
    getNestedValue(obj, path) {
        return path.split('.').reduce((o, k) => (o || {})[k], store);
    }

    // 누락 필드 분석
    getMissingFields(store) {
        const fields = this.getRequiredFields();
        const missing = {};
        
        Object.entries(fields).forEach(([category, fieldList]) => {
            missing[category] = fieldList.filter(field => {
                const value = this.getNestedValue(store, field);
                return value === null || value === undefined || value === '';
            });
        });
        
        return missing;
    }

    // 법적 필수 항목 완료 여부
    isLegalComplete(store) {
        const legalFields = this.getRequiredFields().legal;
        return legalFields.every(field => {
            const value = this.getNestedValue(store, field);
            return value !== null && value !== undefined && value !== '';
        });
    }

    // AI 기반 매장 정보 자동 보완
    async enhanceStoreInfo(storeId, options = {}) {
        const store = await Store.findById(storeId);
        if (!store) {
            throw new Error('매장을 찾을 수 없습니다.');
        }

        const completion = this.calculateCompletionScore(store);
        const enhancements = {};
        const suggestions = [];

        // 1. 누락된 필수 필드 AI 자동 생성
        const missingLegal = this.getMissingFields(store).legal;
        if (missingLegal.length > 0) {
            const generated = await this.generateMissingLegalFields(store, missingLegal);
            Object.assign(enhancements, generated);
        }

        // 2. 영업시간 자동 생성 (업종 기반)
        if (!store.open_time || !store.close_time) {
            const hours = await this.generateBusinessHours(store);
            if (hours) {
                enhancements.open_time = hours.open_time;
                enhancements.close_time = hours.close_time;
                suggestions.push('업종 기반 영업시간이 자동 생성되었습니다.');
            }
        }

        // 3. 업종 분류 자동 생성
        if (!store.business_type && (store.name || store.description)) {
            const businessType = await this.classifyBusinessType(store);
            if (businessType) {
                enhancements.business_type = businessType;
                suggestions.push(`업종이 "${businessType}"(으)로 자동 분류되었습니다.`);
            }
        }

        // 4. 결제 수단 기본값 설정
        if (!store.enabled_payment_methods) {
            enhancements.enabled_payment_methods = JSON.stringify(['cash', 'store_card', 'transfer']);
            suggestions.push('기본 결제 수단(현금, 스토어카드, 계좌이체)이 설정되었습니다.');
        }

        // 5. 정산 주기 기본값
        if (!store.settlement_cycle) {
            enhancements.settlement_cycle = 'MONTHLY';
            suggestions.push('정산 주기가 월정산(MONTHLY)으로 설정되었습니다.');
        }

        // 6. 수수료율/부가세율 기본값
        if (!store.commission_rate) enhancements.commission_rate = 0.03;
        if (!store.vat_rate) enhancements.vat_rate = 0.10;

        // 7. AI 기반 매장 설명 생성
        if (!store.description && (store.name || store.business_type)) {
            const description = await this.generateStoreDescription(store);
            if (description) {
                enhancements.description = description;
                suggestions.push('매장 설명이 AI로 자동 생성되었습니다.');
            }
        }

        // 8. AI 기반 메뉴/서비스 제안
        const serviceSuggestions = await this.generateServiceSuggestions(store);
        if (serviceSuggestions.length > 0) {
            suggestions.push(...serviceSuggestions);
        }

        // 9. 완료도 재계산
        const enhancedStore = { ...store, ...enhancements };
        const newCompletion = this.calculateCompletionScore(enhancedStore);

        return {
            storeId: storeId,
            originalCompletion: this.calculateCompletionScore(store).score,
            newCompletion: newCompletion.score,
            enhancements,
            suggestions,
            missingFields: this.getMissingFields(enhancedStore),
            isLegalComplete: newCompletion.isLegalComplete,
            canOperate: newCompletion.canOperate
        };
    }

    // 법적 필수 필드 AI 자동 생성
    async generateMissingLegalFields(store, missingFields) {
        if (missingFields.length === 0) return {};

        const prompt = `
다음 매장 정보를 바탕으로 누락된 법적 필수 필드를 생성해주세요.

매장 정보:
- 이름: ${store.name || '정보 없음'}
- 주소: ${store.address || '정보 없음'}
- 전화: ${store.phone || '정보 없음'}
- 업종: ${store.business_type || '정보 없음'}
- 현재 대표자명: ${store.ceo_name || '미설정'}

누락 필드: ${missingFields.join(', ')}

다음을 JSON 형식으로 반환해주세요 (한국 법규 준수):
{
  "business_name": "자동 생성된 법인명/상호명",
  "ceo_name": "대표자명 (미설정 시 빈 문자열)",
  "tax_invoice_email": "세금계산서 이메일 (형식: email@domain.com)",
  "mail_order_number": "통신판매업신고번호 (형식: 제202X-지역-숫자호)",
  "business_address": "사업장 소재지 (도로명주소 전체)",
  "customer_service_phone": "고객센터 전화번호 (형식: 02-XXXX-XXXX 또는 010-XXXX-XXXX)",
  "customer_service_email": "고객센터 이메일",
  "terms_of_service": "이용약관 (한국 표준 약관 기반)",
  "privacy_policy": "개인정보처리방침 (개인정보보호법 준수)",
  "refund_policy": "환불·취소 정책 (전자상거래법 준수)"
}

값을 모르면 빈 문자열("")로 설정하세요. 한국 법규(전자상거래법, 통신판매업법, 개인정보보호법) 준수 필수.
        `;

        try {
            const response = await aiService.generateWithFallback(prompt, {
                generationConfig: { temperature: 0.3, response_mime_type: 'application/json' }
            });
            
            const parsed = JSON.parse(response.replace(/```json|```/g, '').trim());
            
            // 유효한 필드만 필터링
            const result = {};
            Object.entries(parsed).forEach(([key, value]) => {
                if (value && value !== '') {
                    result[key] = value;
                }
            });
            
            logger.info('[StoreEnhancement] Legal fields generated:', Object.keys(result));
            return result;
        } catch (error) {
            logger.error('[StoreEnhancement] Legal fields generation failed:', error.message);
            return {};
        }
    }

    // 영업시간 자동 생성 (업종 기반)
    async generateBusinessHours(store) {
        const businessType = store.business_type || '기타';
        
        const prompt = `
업종: ${businessType}
매장명: ${store.name || '정보 없음'}

이 업종의 일반적인 영업시간을 JSON으로 제안해주세요:
{
  "open_time": "HH:MM",
  "close_time": "HH:MM",
  "business_hours": [
    {"day": "MON", "open": "HH:MM", "close": "HH:MM", "is_closed": false},
    {"day": "TUE", "open": "HH:MM", "close": "HH:MM", "is_closed": false},
    {"day": "WED", "open": "HH:MM", "close": "HH:MM", "is_closed": false},
    {"day": "THU", "open": "HH:MM", "close": "HH:MM", "is_closed": false},
    {"day": "FRI", "open": "HH:MM", "close": "HH:MM", "is_closed": false},
    {"day": "SAT", "open": "HH:MM", "close": "HH:MM", "is_closed": false},
    {"day": "SUN", "open": "HH:MM", "close": "HH:MM", "is_closed": true}
  ]
}

한국 일반 ${businessType} 업종의 일반적인 영업시간을 반영하세요.
        `;

        try {
            const response = await aiService.generateWithFallback(prompt, {
                generationConfig: { temperature: 0.3, response_mime_type: 'application/json' }
            });
            
            const parsed = JSON.parse(response.replace(/```json|```/g, '').trim());
            return {
                open_time: parsed.open_time,
                close_time: parsed.close_time,
                business_hours: JSON.stringify(parsed.business_hours || [])
            };
        } catch (error) {
            logger.warn('[StoreEnhancement] Business hours generation failed:', error.message);
            // 기본값 반환
            return {
                open_time: '09:00',
                close_time: '22:00',
                business_hours: JSON.stringify([
                    { day: 'MON', open: '09:00', close: '22:00', is_closed: false },
                    { day: 'TUE', open: '09:00', close: '22:00', is_closed: false },
                    { day: 'WED', open: '09:00', close: '22:00', is_closed: false },
                    { day: 'THU', open: '09:00', close: '22:00', is_closed: false },
                    { day: 'FRI', open: '09:00', close: '22:00', is_closed: false },
                    { day: 'SAT', open: '09:00', close: '22:00', is_closed: false },
                    { day: 'SUN', open: '09:00', close: '22:00', is_closed: true }
                ])
            };
        }
    }

    // 업종 자동 분류
    async classifyBusinessType(store) {
        if (!store.name && !store.description) return null;

        const prompt = `
매장명: ${store.name || '정보 없음'}
설명: ${store.description || '정보 없음'}
주소: ${store.address || '정보 없음'}

위 정보를 바탕으로 가장 적절한 한국 표준 업종을 하나만 선택해주세요.
가능한 업종: 한식, 중식, 일식, 양식, 분식, 치킨, 피자, 카페, 베이커리, 디저트, 음료, 주류, 편의점, 마트, 기타

JSON만 반환: {"business_type": "업종명"}
        `;

        try {
            const response = await aiService.generateWithFallback(prompt, {
                generationConfig: { temperature: 0.2, response_mime_type: 'application/json' }
            });
            
            const parsed = JSON.parse(response.replace(/```json|```/g, '').trim());
            return parsed.business_type || null;
        } catch (error) {
            logger.warn('[StoreEnhancement] Business type classification failed:', error.message);
            return null;
        }
    }

    // 매장 설명 자동 생성
    async generateStoreDescription(store) {
        if (!store.name && !store.business_type) return null;

        const prompt = `
매장명: ${store.name}
업종: ${store.business_type || '미정'}
주소: ${store.address || '미정'}
특징: ${store.description || '없음'}

이 매장을 소개하는 매력적인 한글 설명을 2~3문장으로 작성해주세요.
고객의 방문 욕구를 자극하는 톤앤매너로 작성해주세요.
        `;

        try {
            return await aiService.generateWithFallback(prompt, {
                generationConfig: { temperature: 0.7 }
            });
        } catch (error) {
            logger.warn('[StoreEnhancement] Description generation failed:', error.message);
            return `${store.name}은(는) ${store.business_type || '맛있는'} 음식을 제공하는 매장입니다.`;
        }
    }

    // AI 기반 서비스/메뉴 제안
    async generateServiceSuggestions(store) {
        const suggestions = [];
        
        // 업종별 추천 서비스
        const serviceMap = {
            '카페': ['원두 판매', '디저트 세트', '시그니처 음료', '스터디 공간 제공'],
            '베이커리': ['케이크 예약', '생일 케이크', '선물 세트', '당일 생산 당일 판매'],
            '한식': ['점심 특선', '가족 세트', '포장/배달', '단체 예약'],
            '치킨': ['세트 메뉴', '사이드 메뉴', '소스 선택', '치맥 세트'],
            '피자': ['하프앤하프', '세트 메뉴', '사이드/음료', '방문 포장 할인'],
            '분식': ['세트 메뉴', '즉석 조리', '포장 가능', '학생 할인'],
            '주류': ['안주 세트', '하프 보틀', '술자리 세트', '단체 예약']
        };

        const businessType = store.business_type;
        if (businessType && serviceMap[businessType]) {
            suggestions.push(
                `추천 서비스: ${serviceMap[businessType].join(', ')}`,
                '해당 서비스를 메뉴/옵션으로 추가해보세요.'
            );
        }

        return suggestions;
    }

    // 매장 정보 자동 완성 (자동 저장 포함)
    async autoCompleteStoreInfo(storeId, options = {}) {
        const enhancement = await this.enhanceStoreInfo(storeId);
        
        if (options.autoSave && Object.keys(enhancement.enhancements).length > 0) {
            const updated = await Store.update(storeId, enhancement.enhancements);
            return {
                ...enhancement,
                saved: true,
                updatedStore: updated
            };
        }
        
        return enhancement;
    }

    // 매장 정보 검증 및 보완 리포트
    async generateCompletionReport(storeId) {
        const store = await Store.findById(storeId);
        if (!store) throw new Error('매장을 찾을 수 없습니다.');

        const completion = this.calculateCompletionScore(store);
        const missing = this.getMissingFields(store);
        
        return {
            storeId,
            storeName: store.name,
            completionScore: completion.score,
            isComplete: completion.isComplete,
            isLegalComplete: completion.isLegalComplete,
            canOperate: completion.canOperate,
            totalFields: completion.totalFields,
            filledFields: completion.filledFields,
            missingByCategory: missing,
            missingCount: Object.values(missing).flat().length,
            priorityActions: this.getPriorityActions(missing),
            recommendations: await this.getRecommendations(store)
        };
    }

    // 우선순위 액션 도출
    getPriorityActions(missing) {
        const actions = [];
        
        if (missing.legal.length > 0) {
            actions.push({
                priority: 'CRITICAL',
                category: 'legal',
                message: `법적 필수 항목 ${missing.legal.length}개 미완료: ${missing.legal.join(', ')}`,
                action: '법적 필수 항목 즉시 작성 필요 (영업 정지 사유 가능)'
            });
        }
        
        if (missing.basic.length > 0) {
            actions.push({
                priority: 'HIGH',
                category: 'basic',
                message: `기본 정보 ${missing.basic.length}개 미완료: ${missing.basic.join(', ')}`,
                action: '기본 정보 즉시 작성 필요'
            });
        }
        
        if (missing.settlement.length > 0) {
            actions.push({
                priority: 'HIGH',
                category: 'settlement',
                message: `정산 설정 ${missing.settlement.length}개 미완료: ${missing.settlement.join(', ')}`,
                action: '정산 주기/수수료율 설정 필요'
            });
        }
        
        if (missing.payment.length > 0) {
            actions.push({
                priority: 'MEDIUM',
                category: 'payment',
                message: '결제 수단 미설정',
                action: '결제 수단 기본값 설정 권장'
            });
        }
        
        return actions.sort((a, b) => {
            const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    }

    // 추천사항 생성
    async getRecommendations(store) {
        const recs = [];
        
        if (!store.description) {
            recs.push({ type: 'description', message: '매장 설명 추가로 고객 유입 증대 기대' });
        }
        
        if (!store.latitude || !store.longitude) {
            recs.push({ type: 'location', message: '위도/경도 설정 시 거리 기반 검색/추천 정확도 향상' });
        }
        
        if (!store.theme) {
            recs.push({ type: 'branding', message: '테마/브랜딩 설정으로 브랜드 인지도 강화' });
        }
        
        if (!store.plan || store.plan === 'free') {
            recs.push({ type: 'plan', message: '프로/엔터프라이즈 플랜 업그레이드로 고급 기능 활용 가능' });
        }
        
        return recs;
    }
}

module.exports = new StoreInfoEnhancementService();
