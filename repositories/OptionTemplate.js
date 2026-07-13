const prisma = require('../config/prisma');

/**
 * [옵션 템플릿 레포지토리]
 * 각 가맹점 매장의 메뉴 옵션(토핑, 당도, 사이즈 등) 템플릿의 DB 저장을 담당합니다.
 */
const OptionTemplate = {
    /**
     * 특정 매장의 전체 옵션 템플릿 조회
     */
    findByStoreId: async (storeId) => {
        return await prisma.option_templates.findMany({
            where: { store_id: parseInt(storeId) },
            orderBy: { created_at: 'desc' }
        });
    },

    /**
     * 특정 옵션 템플릿 상세 조회
     */
    findById: async (id) => {
        return await prisma.option_templates.findUnique({
            where: { id: parseInt(id) }
        });
    },

    /**
     * 신규 옵션 템플릿 생성
     */
    create: async (data) => {
        return await prisma.option_templates.create({ data });
    },

    /**
     * 기존 옵션 템플릿 수정
     */
    update: async (id, data) => {
        return await prisma.option_templates.update({
            where: { id: parseInt(id) },
            data
        });
    },

    /**
     * 특정 옵션 템플릿 삭제
     */
    delete: async (id) => {
        return await prisma.option_templates.delete({
            where: { id: parseInt(id) }
        });
    }
};

module.exports = OptionTemplate;
