/**
 * notificationTemplate.js — 알림 템플릿 렌더링 (F4)
 *
 * 관리자가 커스터마이징한 notification_templates를 실제 알림 발송에 적용한다.
 * 매장 전용 템플릿을 우선 사용하고, 없으면 전역 템플릿(store_id=null), 그것도
 * 없으면 null을 반환해 호출부가 기본(하드코딩) 문구로 폴백하게 한다.
 *
 * 문구의 `{{변수}}` 자리표시자는 vars 값으로 치환된다.
 * 예: "주문 #{{orderNumber}} 접수" + { orderNumber: 12 } → "주문 #12 접수"
 */
const prisma = require('../config/prisma');
const logger = require('./logger');

/** `{{var}}` 치환 (값 없으면 빈 문자열) */
function render(str, vars = {}) {
    return String(str || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) =>
        vars[key] != null ? String(vars[key]) : ''
    );
}

/**
 * 매장 활성 템플릿을 조회해 렌더한 { title, message } 반환. 없으면 null.
 * @param {number|string} storeId
 * @param {string} type   NEW_ORDER | ORDER_STATUS | LOW_STOCK | NEW_REVIEW ...
 * @param {object} vars   치환 변수
 */
async function resolveTemplate(storeId, type, vars = {}) {
    try {
        const tpl = await prisma.notification_templates.findFirst({
            where: {
                type,
                is_active: true,
                OR: [{ store_id: Number(storeId) }, { store_id: null }],
            },
            // 매장 전용(store_id 비 null)을 전역보다 우선
            orderBy: { store_id: { sort: 'desc', nulls: 'last' } },
        });
        if (!tpl) return null;
        return { title: render(tpl.title, vars), message: render(tpl.message, vars) };
    } catch (err) {
        logger.warn(`[notificationTemplate] ${type} 조회 실패: ${err.message}`);
        return null; // 실패 시 기본 문구로 폴백
    }
}

module.exports = { resolveTemplate, render };
